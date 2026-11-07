using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliceBharti.Api.Data;
using PoliceBharti.Api.Services;

namespace PoliceBharti.Api.Endpoints;

public record SaveBankDto(string Name, List<ParsedQuestion> Questions);

/// <summary>"Custom" mode: a user uploads their own questions (PDF / image / text) into a private bank and practises on it.</summary>
public static class CustomEndpoints
{
    const int MaxBanksPerUser = 20, MaxQuestionsPerBank = 1000;
    const int MaxFiles = 8, MaxFileBytes = 10 * 1024 * 1024, MaxTotalBytes = 20 * 1024 * 1024, MaxImageBytes = 5 * 1024 * 1024;
    const int MaxTextChars = 200_000;
    static readonly JsonSerializerOptions JsonOpts = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static void MapCustom(this WebApplication app)
    {
        var g = app.MapGroup("/api/custom").RequireAuthorization();

        g.MapGet("/status", (QuestionExtractor ai) => new { aiEnabled = ai.Enabled, maxQuestions = QuestionExtractor.MaxQuestions });

        g.MapGet("/banks", async (HttpContext ctx, AppDbContext db) =>
        {
            var uid = ctx.User.UserId();
            var banks = await db.CustomBanks.Where(b => b.UserId == uid).OrderByDescending(b => b.Id).ToListAsync();
            var ids = banks.Select(b => b.Id).ToList();
            var qs = await db.Questions.Where(q => q.BankId != null && ids.Contains(q.BankId.Value))
                .Select(q => new { BankId = q.BankId!.Value, q.Subject, q.SubjectMr }).ToListAsync();
            return banks.Select(b => new
            {
                b.Id, b.Name, b.CreatedAt,
                questions = qs.Count(q => q.BankId == b.Id),
                subjects = qs.Where(q => q.BankId == b.Id).GroupBy(q => (q.Subject, q.SubjectMr))
                    .Select(s => new { subject = s.Key.Subject, name = new Bi<string>(s.Key.SubjectMr, s.Key.Subject), count = s.Count() }),
            });
        });

        // Step 1: read the upload and return a preview. Nothing is saved yet.
        g.MapPost("/parse", async (HttpRequest req, QuestionExtractor ai, ILogger<QuestionExtractor> log, CancellationToken ct) =>
        {
            if (!req.HasFormContentType) return Results.BadRequest(new { error = "Send the file as multipart form data." });
            var form = await req.ReadFormAsync(ct);
            var pasted = form["text"].ToString();
            if (pasted.Length > MaxTextChars) return Results.BadRequest(new { error = "Text is too long (max 200,000 characters)." });
            if (form.Files.Count > MaxFiles) return Results.BadRequest(new { error = $"Upload at most {MaxFiles} files at a time." });

            var files = new List<UploadedFile>();
            long total = 0;
            foreach (var f in form.Files)
            {
                if (f.Length == 0) continue;
                if (f.Length > MaxFileBytes) return Results.BadRequest(new { error = $"'{f.FileName}' is larger than 10 MB." });
                total += f.Length;
                if (total > MaxTotalBytes) return Results.BadRequest(new { error = "Total upload is larger than 20 MB." });
                var kind = Classify(f.FileName, f.ContentType);
                if (kind is null) return Results.BadRequest(new { error = $"'{f.FileName}': unsupported type. Use PDF, JPG/PNG/WEBP/GIF image, or a text/CSV file." });
                if (kind.StartsWith("image/") && f.Length > MaxImageBytes) return Results.BadRequest(new { error = $"'{f.FileName}': images must be under 5 MB." });
                using var ms = new MemoryStream();
                await f.CopyToAsync(ms, ct);
                files.Add(new UploadedFile(f.FileName, kind, ms.ToArray()));
            }
            if (files.Count == 0 && string.IsNullOrWhiteSpace(pasted)) return Results.BadRequest(new { error = "Choose a file or paste some text." });

            var needsAi = files.Any(f => !f.MediaType.StartsWith("text/"));
            var note = "";
            string method;
            List<ParsedQuestion> parsed;
            if (ai.Enabled)
            {
                try { (parsed, note) = await ai.ExtractAsync(files, pasted, ct); method = "ai"; }
                catch (Exception e) when (!needsAi && e is not OperationCanceledException)
                {
                    log.LogWarning(e, "AI extraction failed; using the offline text parser");
                    parsed = ParseTextLocally(files, pasted); method = "text";
                    note = "AI reading failed, so the offline text parser was used (no subject/topic detection). " + e.Message;
                }
                catch (Exception e) when (e is not OperationCanceledException)
                { return Results.Json(new { error = "Could not read the file: " + e.Message }, statusCode: 502); }
            }
            else
            {
                if (needsAi)
                    return Results.Json(new { error = "Reading PDF/image files needs the AI reader, which is not configured on this server (set Anthropic__ApiKey). You can still upload or paste plain text." }, statusCode: 501);
                parsed = ParseTextLocally(files, pasted); method = "text";
                note = "Offline text parser used - questions need the layout '1. question / A) … D) … / Answer: B'. Subjects and topics could not be detected.";
            }

            var questions = parsed.Select(Clean).Where(q => q is not null).Cast<ParsedQuestion>().Take(MaxQuestionsPerBank).ToList();
            var dropped = parsed.Count - questions.Count;
            if (dropped > 0) note = (note + $" {dropped} item(s) were incomplete and skipped.").Trim();
            if (questions.Count == 0)
                return Results.BadRequest(new { error = "No complete 4-option questions were found. Check the file layout." + (note != "" ? " " + note : "") });
            return Results.Ok(new
            {
                method, note,
                needsAnswerCheck = questions.Count(q => q.Correct < 0 || !q.AnswerFromSource),
                questions,
            });
        }).RequireRateLimiting("upload");

        // Step 2: save the (reviewed) questions into a bank. A bank with the same name gets the questions appended.
        g.MapPost("/banks", async (SaveBankDto dto, HttpContext ctx, AppDbContext db) =>
        {
            var uid = ctx.User.UserId();
            var name = (dto.Name ?? "").Trim();
            if (name.Length is 0 or > 120) return Results.BadRequest(new { error = "Bank name is required (max 120 characters)." });
            var clean = (dto.Questions ?? []).Select(Clean).Where(q => q is not null && q.Correct is >= 0 and <= 3).Cast<ParsedQuestion>().ToList();
            if (clean.Count == 0) return Results.BadRequest(new { error = "No valid questions to save." });

            var bank = await db.CustomBanks.FirstOrDefaultAsync(b => b.UserId == uid && b.Name.ToLower() == name.ToLower());
            if (bank is null)
            {
                if (await db.CustomBanks.CountAsync(b => b.UserId == uid) >= MaxBanksPerUser)
                    return Results.BadRequest(new { error = $"You can keep at most {MaxBanksPerUser} banks. Delete one first." });
                bank = new CustomBank { UserId = uid, Name = name };
                db.CustomBanks.Add(bank);
                await db.SaveChangesAsync();
            }
            var existing = await db.Questions.Where(q => q.BankId == bank.Id).Select(q => q.Text + "|" + q.OptionsJson).ToListAsync();
            if (existing.Count >= MaxQuestionsPerBank)
                return Results.BadRequest(new { error = $"A bank can hold at most {MaxQuestionsPerBank} questions." });
            var seen = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);

            int added = 0, dup = 0;
            foreach (var p in clean)
            {
                if (existing.Count + added >= MaxQuestionsPerBank) break;
                var optsJson = JsonSerializer.Serialize(p.Options, JsonOpts);
                if (!seen.Add(p.Text + "|" + optsJson)) { dup++; continue; }
                // Custom questions have one language only: store it in both columns so the language toggle keeps working.
                db.Questions.Add(new Question
                {
                    BankId = bank.Id, Subject = p.Subject, SubjectMr = p.SubjectMr, Topic = p.Topic, TopicMr = p.TopicMr,
                    Text = p.Text, TextMr = p.Text, OptionsJson = optsJson, OptionsJsonMr = optsJson,
                    CorrectIndex = p.Correct, Explanation = p.Explanation, ExplanationMr = p.Explanation, Difficulty = p.Difficulty,
                });
                added++;
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { bankId = bank.Id, name = bank.Name, added, duplicates = dup });
        });

        g.MapDelete("/banks/{id:int}", async (int id, HttpContext ctx, AppDbContext db) =>
        {
            var uid = ctx.User.UserId();
            var bank = await db.CustomBanks.FirstOrDefaultAsync(b => b.Id == id && b.UserId == uid);
            if (bank is null) return Results.NotFound();
            var attemptIds = await db.Attempts.Where(a => a.BankId == id).Select(a => a.Id).ToListAsync();
            await db.AttemptAnswers.Where(x => attemptIds.Contains(x.AttemptId)).ExecuteDeleteAsync();
            await db.Attempts.Where(a => a.BankId == id).ExecuteDeleteAsync();
            await db.Questions.Where(q => q.BankId == id).ExecuteDeleteAsync();
            db.CustomBanks.Remove(bank);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    static List<ParsedQuestion> ParseTextLocally(List<UploadedFile> files, string pasted)
    {
        var text = string.Join("\n", files.Select(f => System.Text.Encoding.UTF8.GetString(f.Data)).Append(pasted));
        return TextQuestionParser.Parse(text.TrimStart('﻿'));
    }

    /// <summary>Returns the media type to send on, or null if the file type is not supported.</summary>
    static string? Classify(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".pdf" => "application/pdf",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".txt" or ".csv" or ".md" or ".text" => "text/plain",
            _ => contentType switch
            {
                "application/pdf" => "application/pdf",
                "image/jpeg" or "image/png" or "image/webp" or "image/gif" => contentType,
                _ when contentType.StartsWith("text/") => "text/plain",
                _ => null,
            },
        };
    }

    static string Cut(string? s, int n) { s = (s ?? "").Trim(); return s.Length > n ? s[..n] : s; }

    /// <summary>Normalises one question; returns null if it is unusable. Correct stays -1 when the answer is unknown.</summary>
    internal static ParsedQuestion? Clean(ParsedQuestion q)
    {
        var opts = (q.Options ?? []).Select(o => Cut(o, 500)).ToArray();
        var text = Cut(q.Text, 2000);
        if (text == "" || opts.Length != 4 || opts.Any(o => o == "") || opts.Distinct(StringComparer.OrdinalIgnoreCase).Count() < 4) return null;
        var subject = Cut(q.Subject, 60); var topic = Cut(q.Topic, 80);
        if (subject == "") subject = "General";
        if (topic == "") topic = subject;
        return new ParsedQuestion
        {
            Text = text, Options = opts,
            Correct = q.Correct is >= 0 and <= 3 ? q.Correct : -1,
            AnswerFromSource = q.AnswerFromSource && q.Correct is >= 0 and <= 3,
            Subject = subject, SubjectMr = Cut(q.SubjectMr, 100) is { Length: > 0 } sm ? sm : subject,
            Topic = topic, TopicMr = Cut(q.TopicMr, 100) is { Length: > 0 } tm ? tm : topic,
            Difficulty = Math.Clamp(q.Difficulty, 1, 3), Explanation = Cut(q.Explanation, 1000),
        };
    }
}
