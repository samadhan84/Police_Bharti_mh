using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliceBharti.Api.Data;
using PoliceBharti.Api.Services;

namespace PoliceBharti.Api.Endpoints;

public record AiTestDto(int? Count, string? Subject);

/// <summary>
/// "New AI Test": every click writes brand-new questions with the AI and starts a test on them.
/// The questions are saved in the student's private "AI Practice" bank (so results, review and analytics work as usual).
/// </summary>
public static class AiTestEndpoints
{
    public const string BankName = "AI Practice";
    const int MaxBankQuestions = 1000;
    static readonly JsonSerializerOptions JsonOpts = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static void MapAiTest(this WebApplication app)
    {
        app.MapPost("/api/ai-test", async (AiTestDto dto, HttpContext ctx, AppDbContext db, QuestionExtractor ai, ILogger<QuestionExtractor> log, CancellationToken ct) =>
        {
            if (!ai.Enabled)
                return Results.Json(new { error = "AI tests are not switched on on this server yet (the administrator must set Anthropic__ApiKey). / या सर्व्हरवर AI चाचणी अजून सुरू नाही." }, statusCode: 501);
            var uid = ctx.User.UserId();
            var count = Math.Clamp(dto.Count ?? 15, 5, 25);

            // subjects come from the official bank so analytics stay consistent
            var subjects = (await db.Questions.Where(q => q.BankId == null).Select(q => new { q.Subject, q.SubjectMr }).Distinct().ToListAsync(ct))
                .ToDictionary(x => x.Subject, x => x.SubjectMr, StringComparer.OrdinalIgnoreCase);
            if (subjects.Count == 0) return Results.BadRequest(new { error = "No subjects available." });

            Dictionary<string, int> wanted;
            if (!string.IsNullOrWhiteSpace(dto.Subject))
            {
                var key = subjects.Keys.FirstOrDefault(k => k.Equals(dto.Subject, StringComparison.OrdinalIgnoreCase));
                if (key is null) return Results.BadRequest(new { error = "Unknown subject." });
                wanted = new() { [key] = count };
            }
            else
            {
                var keys = subjects.Keys.OrderBy(k => k).ToList();
                wanted = keys.Select((k, i) => (k, n: count / keys.Count + (i < count % keys.Count ? 1 : 0))).Where(x => x.n > 0).ToDictionary(x => x.k, x => x.n);
            }

            var bank = await db.CustomBanks.FirstOrDefaultAsync(b => b.UserId == uid && b.Name == BankName, ct);
            if (bank is null) { bank = new CustomBank { UserId = uid, Name = BankName }; db.CustomBanks.Add(bank); await db.SaveChangesAsync(ct); }
            var existing = await db.Questions.Where(q => q.BankId == bank.Id).Select(q => q.Id).CountAsync(ct);
            if (existing + count > MaxBankQuestions)
                return Results.BadRequest(new { error = "Your 'AI Practice' bank is full. Delete it in the Custom tab and start again. / तुमचा 'AI Practice' प्रश्नसंच भरला आहे. तो Custom टॅबमध्ये हटवून पुन्हा सुरू करा." });

            // show the model what this student (and the shared bank) already has, so questions are new
            var avoid = (await db.Questions.Where(q => q.BankId == bank.Id || q.BankId == null).OrderByDescending(q => q.Id).Select(q => q.Text).Take(100).ToListAsync(ct))
                .Select(t => t.Length > 100 ? t[..100] : t).ToList();

            List<JsonElement> generated;
            try { generated = await ai.GenerateAsync(wanted, avoid, ct); }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "AI test generation failed");
                return Results.Json(new { error = "Could not write new questions right now: " + e.Message }, statusCode: 502);
            }

            var seen = (await db.Questions.Where(q => q.BankId == bank.Id).Select(q => q.Text + "|" + q.OptionsJson).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var questions = new List<Question>();
            foreach (var g in generated)
            {
                var q = ToQuestion(g, subjects, bank.Id);
                if (q is null || !seen.Add(q.Text + "|" + q.OptionsJson)) continue;
                if (!wanted.ContainsKey(q.Subject)) continue;
                questions.Add(q);
            }
            if (questions.Count < Math.Min(5, count))
                return Results.Json(new { error = "The AI returned too few usable questions. Please try again." }, statusCode: 502);

            db.Questions.AddRange(questions);
            await db.SaveChangesAsync(ct);

            // sections stay together, like the real paper
            var picked = questions.GroupBy(q => q.Subject).SelectMany(s => s).ToList();
            var limitSec = picked.Count * 54;
            var attempt = new Attempt
            {
                UserId = uid, Mode = "ai", BankId = bank.Id, Subject = string.IsNullOrWhiteSpace(dto.Subject) ? null : wanted.Keys.First(),
                DurationLimitSec = limitSec, Total = picked.Count,
                Answers = picked.Select((q, i) => new AttemptAnswer { QuestionId = q.Id, Order = i }).ToList(),
            };
            db.Attempts.Add(attempt);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new
            {
                attemptId = attempt.Id, durationSec = limitSec, startedAt = attempt.StartedAt,
                questions = picked.Select(q => new
                {
                    q.Id, subject = q.Subject, subjectName = q.Name(false), topic = q.Name(true),
                    text = new Bi<string>(q.TextMr, q.Text), options = new Bi<string[]>(q.OptionsMr(), q.Options()),
                }),
            });
        }).RequireAuthorization().RequireRateLimiting("aitest");
    }

    static string S(JsonElement e, string k, int max)
    {
        var s = e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "").Trim() : "";
        return s.Length > max ? s[..max] : s;
    }

    static string[]? Opts(JsonElement e, string k)
    {
        if (!e.TryGetProperty(k, out var v) || v.ValueKind != JsonValueKind.Array) return null;
        var o = v.EnumerateArray().Select(x => (x.ValueKind == JsonValueKind.String ? x.GetString() ?? "" : x.ToString()).Trim()).ToArray();
        return o.Length == 4 && o.All(x => x != "") && o.Distinct(StringComparer.OrdinalIgnoreCase).Count() == 4 ? o : null;
    }

    /// <summary>Validates one generated question; returns null when it is unusable.</summary>
    static Question? ToQuestion(JsonElement g, Dictionary<string, string> subjects, int bankId)
    {
        var key = subjects.Keys.FirstOrDefault(k => k.Equals(S(g, "subject", 60), StringComparison.OrdinalIgnoreCase));
        if (key is null) return null;
        var en = Opts(g, "options_en"); var mr = Opts(g, "options_mr");
        var ci = g.TryGetProperty("correct_index", out var c) && c.TryGetInt32(out var i) ? i : -1;
        string qEn = S(g, "question_en", 2000), qMr = S(g, "question_mr", 2000);
        if (en is null || mr is null || ci is < 0 or > 3 || qEn == "" || qMr == "") return null;
        return new Question
        {
            BankId = bankId, Subject = key, SubjectMr = subjects[key],
            Topic = S(g, "topic_en", 80) is { Length: > 0 } t ? t : key, TopicMr = S(g, "topic_mr", 100) is { Length: > 0 } tm ? tm : subjects[key],
            Text = qEn, TextMr = qMr,
            OptionsJson = JsonSerializer.Serialize(en, JsonOpts), OptionsJsonMr = JsonSerializer.Serialize(mr, JsonOpts),
            CorrectIndex = ci, Explanation = S(g, "explanation_en", 1000), ExplanationMr = S(g, "explanation_mr", 1000),
            Difficulty = g.TryGetProperty("difficulty", out var d) && d.TryGetInt32(out var di) ? Math.Clamp(di, 1, 3) : 2,
        };
    }
}
