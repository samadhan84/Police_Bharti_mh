using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliceBharti.Api.Data;

namespace PoliceBharti.Api.Endpoints;

public record ImportDto(string Format, string Content, bool DryRun);

public static class AdminEndpoints
{
    static readonly string[] Columns =
    [
        "subject", "subject_mr", "topic_en", "topic_mr", "difficulty",
        "question_en", "question_mr",
        "en_a", "en_b", "en_c", "en_d", "mr_a", "mr_b", "mr_c", "mr_d",
        "correct", "explanation_en", "explanation_mr",
    ];

    static readonly JsonSerializerOptions JsonOpts = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static void MapAdmin(this WebApplication app)
    {
        var g = app.MapGroup("/api/admin").RequireAuthorization("Admin");

        // ---- CSV template (UTF-8 with BOM so Excel shows Marathi correctly) ----
        g.MapGet("/template.csv", () =>
        {
            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", Columns));
            sb.AppendLine("Arithmetic,,Percentage,टक्केवारी,1,What is 10% of 200?,200 च्या 10% किती?,20,10,30,40,20,10,30,40,A,10/100 × 200 = 20.,10/100 × 200 = 20.");
            sb.AppendLine("Marathi Grammar,,Synonyms,समानार्थी शब्द,1,\"Which word is a synonym of 'सूर्य'?\",'सूर्य' या शब्दाचा समानार्थी शब्द कोणता?,रवि,चंद्र,तारा,ढग,रवि,चंद्र,तारा,ढग,A,रवि is a synonym of सूर्य.,रवि हा सूर्याचा समानार्थी शब्द आहे.");
            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
            return Results.File(bytes, "text/csv; charset=utf-8", "questions-template.csv");
        });

        // ---- overview ----
        g.MapGet("/stats", async (AppDbContext db) => new
        {
            total = await db.Questions.CountAsync(),
            subjects = await db.Questions.GroupBy(q => new { q.Subject, q.SubjectMr })
                .Select(x => new { subject = x.Key.Subject, name = new Bi<string>(x.Key.SubjectMr, x.Key.Subject), count = x.Count() }).ToListAsync(),
            users = await db.Users.CountAsync(),
            attempts = await db.Attempts.CountAsync(a => a.SubmittedAt != null),
        });

        // ---- browse ----
        g.MapGet("/questions", async (AppDbContext db, string? subject, string? q, int page = 1) =>
        {
            var query = db.Questions.AsQueryable();
            if (!string.IsNullOrWhiteSpace(subject)) query = query.Where(x => x.Subject == subject);
            if (!string.IsNullOrWhiteSpace(q)) query = query.Where(x => x.Text.Contains(q) || x.TextMr.Contains(q) || x.Topic.Contains(q) || x.TopicMr.Contains(q));
            var total = await query.CountAsync();
            const int size = 20;
            var items = await query.OrderByDescending(x => x.Id).Skip((Math.Max(page, 1) - 1) * size).Take(size).ToListAsync();
            return Results.Ok(new
            {
                total, page, pages = (int)Math.Ceiling(total / (double)size),
                items = items.Select(x => new
                {
                    x.Id, subject = x.Name(false), topic = x.Name(true), x.Difficulty,
                    text = new Bi<string>(x.TextMr, x.Text), options = new Bi<string[]>(x.OptionsMr(), x.Options()),
                    correct = x.CorrectIndex, explanation = new Bi<string>(x.ExplanationMr, x.Explanation),
                }),
            });
        });

        g.MapDelete("/questions/{id:int}", async (int id, AppDbContext db) =>
        {
            var qn = await db.Questions.FindAsync(id);
            if (qn is null) return Results.NotFound();
            if (await db.AttemptAnswers.AnyAsync(a => a.QuestionId == id))
                return Results.Conflict(new { error = "This question has already been used in student attempts and cannot be deleted. / हा प्रश्न विद्यार्थ्यांच्या चाचण्यांमध्ये वापरला गेला आहे, त्यामुळे हटवता येणार नाही." });
            db.Questions.Remove(qn);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- import (dry run validates only; otherwise inserts every valid row) ----
        g.MapPost("/questions/import", async (ImportDto dto, AppDbContext db) =>
        {
            List<Dictionary<string, string>> rows;
            try { rows = Parse(dto.Format, dto.Content ?? ""); }
            catch (Exception e) { return Results.BadRequest(new { error = "Could not read file: " + e.Message }); }
            if (rows.Count == 0) return Results.BadRequest(new { error = "No rows found. / फाईलमध्ये एकही ओळ सापडली नाही." });
            if (rows.Count > 2000) return Results.BadRequest(new { error = "Max 2000 rows per import. / एका वेळी कमाल 2000 ओळी." });

            var subjects = (await db.Questions.Select(q => new { q.Subject, q.SubjectMr }).Distinct().ToListAsync())
                .ToDictionary(x => x.Subject, x => x.SubjectMr, StringComparer.OrdinalIgnoreCase);
            // duplicate = same subject + same English wording + same options (so look-alike questions with different options are fine)
            var seen = (await db.Questions.Select(q => q.Subject + "|" + q.Text + "|" + q.OptionsJson).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var results = new List<object>();
            var toAdd = new List<Question>();
            int invalid = 0, dup = 0;
            for (var i = 0; i < rows.Count; i++)
            {
                var (q, errors) = Build(rows[i], subjects);
                var label = rows[i].GetValueOrDefault("question_en") ?? "";
                if (errors.Count > 0) { invalid++; results.Add(new { row = i + 1, status = "invalid", errors, preview = label }); continue; }
                var key = q!.Subject + "|" + q.Text + "|" + q.OptionsJson;
                if (!seen.Add(key)) { dup++; results.Add(new { row = i + 1, status = "duplicate", errors = new List<string>(), preview = label }); continue; }
                toAdd.Add(q);
                results.Add(new { row = i + 1, status = "valid", errors = new List<string>(), preview = label });
            }

            if (!dto.DryRun && toAdd.Count > 0)
            {
                db.Questions.AddRange(toAdd);
                await db.SaveChangesAsync();
            }
            return Results.Ok(new { dryRun = dto.DryRun, total = rows.Count, valid = toAdd.Count, invalid, duplicates = dup, imported = dto.DryRun ? 0 : toAdd.Count, rows = results });
        });
    }

    // ---------- parsing ----------
    internal static List<Dictionary<string, string>> Parse(string format, string content)
    {
        content = content.TrimStart('﻿');
        if (format.Equals("json", StringComparison.OrdinalIgnoreCase))
        {
            var list = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(content) ?? [];
            return list.Select(d => d.ToDictionary(kv => kv.Key.Trim().ToLowerInvariant(),
                kv => kv.Value.ValueKind == JsonValueKind.String ? kv.Value.GetString()! : kv.Value.ToString())).ToList();
        }
        var recs = Csv(content);
        if (recs.Count < 2) return [];
        var header = recs[0].Select(h => h.Trim().ToLowerInvariant()).ToArray();
        return recs.Skip(1).Where(r => r.Any(c => !string.IsNullOrWhiteSpace(c)))
            .Select(r => header.Select((h, i) => (h, v: i < r.Length ? r[i] : "")).Where(x => x.h != "")
                .ToDictionary(x => x.h, x => x.v)).ToList();
    }

    /// <summary>RFC-4180 CSV: quoted fields, escaped quotes, commas and newlines inside quotes.</summary>
    static List<string[]> Csv(string s)
    {
        var rows = new List<string[]>(); var row = new List<string>(); var f = new StringBuilder(); var q = false;
        for (var i = 0; i < s.Length; i++)
        {
            var c = s[i];
            if (q)
            {
                if (c == '"') { if (i + 1 < s.Length && s[i + 1] == '"') { f.Append('"'); i++; } else q = false; }
                else f.Append(c);
            }
            else if (c == '"') q = true;
            else if (c == ',') { row.Add(f.ToString()); f.Clear(); }
            else if (c == '\n' || c == '\r')
            {
                if (c == '\r' && i + 1 < s.Length && s[i + 1] == '\n') i++;
                row.Add(f.ToString()); f.Clear(); rows.Add(row.ToArray()); row.Clear();
            }
            else f.Append(c);
        }
        if (f.Length > 0 || row.Count > 0) { row.Add(f.ToString()); rows.Add(row.ToArray()); }
        return rows;
    }

    // ---------- validation ----------
    internal static (Question?, List<string>) Build(Dictionary<string, string> r, Dictionary<string, string> subjects)
    {
        var e = new List<string>();
        string G(string k) => r.TryGetValue(k, out var v) ? v.Trim() : "";
        foreach (var k in new[] { "subject", "topic_en", "topic_mr", "question_en", "question_mr", "explanation_en", "explanation_mr" })
            if (G(k) == "") e.Add($"'{k}' is required");

        // subject: must exist, or be new with a Marathi name
        string subject = G("subject"), subjectMr = "";
        if (subject != "")
        {
            var hit = subjects.Keys.FirstOrDefault(k => k.Equals(subject, StringComparison.OrdinalIgnoreCase))
                      ?? subjects.Keys.FirstOrDefault(k => subjects[k] == subject);
            if (hit != null) { subject = hit; subjectMr = subjects[hit]; }
            else if (G("subject_mr") != "") { subjectMr = G("subject_mr"); subjects[subject] = subjectMr; }
            else e.Add($"Unknown subject '{subject}' (existing: {string.Join(", ", subjects.Keys)}). To add a new subject fill 'subject_mr'.");
        }

        if (!int.TryParse(G("difficulty"), out var diff) || diff is < 1 or > 3) e.Add("'difficulty' must be 1, 2 or 3");

        string[] En = new[] { "en_a", "en_b", "en_c", "en_d" }.Select(G).ToArray();
        string[] Mr = new[] { "mr_a", "mr_b", "mr_c", "mr_d" }.Select(G).ToArray();
        if (En.Any(x => x == "")) e.Add("All four English options (en_a..en_d) are required");
        else if (En.Distinct(StringComparer.OrdinalIgnoreCase).Count() < 4) e.Add("English options must be different from each other");
        if (Mr.Any(x => x == "")) e.Add("All four Marathi options (mr_a..mr_d) are required");
        else if (Mr.Distinct().Count() < 4) e.Add("Marathi options must be different from each other");

        var idx = "ABCD".IndexOf(G("correct").ToUpperInvariant());
        if (G("correct").Length != 1 || idx < 0) e.Add("'correct' must be A, B, C or D");

        if (e.Count > 0) return (null, e);
        return (new Question
        {
            Subject = subject, SubjectMr = subjectMr, Topic = G("topic_en"), TopicMr = G("topic_mr"),
            Text = G("question_en"), TextMr = G("question_mr"),
            OptionsJson = JsonSerializer.Serialize(En, JsonOpts), OptionsJsonMr = JsonSerializer.Serialize(Mr, JsonOpts),
            CorrectIndex = idx, Explanation = G("explanation_en"), ExplanationMr = G("explanation_mr"), Difficulty = diff,
        }, e);
    }
}
