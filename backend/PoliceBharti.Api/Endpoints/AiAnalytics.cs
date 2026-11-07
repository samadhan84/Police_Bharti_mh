using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliceBharti.Api.Data;
using PoliceBharti.Api.Services;

namespace PoliceBharti.Api.Endpoints;

/// <summary>
/// AI-written analysis, "what to study" list and 7-day study plan for one student.
/// Only aggregate numbers are sent to the AI (no name, e-mail or question text).
/// The result is cached until the student finishes another test, so opening the page repeatedly costs nothing.
/// </summary>
public static class AiAnalyticsEndpoints
{
    public static void MapAiAnalytics(this WebApplication app)
    {
        app.MapGet("/api/analytics/ai", async (HttpContext ctx, AppDbContext db, QuestionExtractor ai, IMemoryCache cache, ILogger<QuestionExtractor> log, int? bank, CancellationToken ct) =>
        {
            if (!ai.Enabled) return Results.Json(new { error = "AI is not switched on on this server." }, statusCode: 501);
            var uid = ctx.User.UserId();

            var attempts = await db.Attempts.Where(a => a.UserId == uid && a.SubmittedAt != null && a.BankId == bank)
                .OrderBy(a => a.SubmittedAt).Select(a => new { a.Id, a.Mode, a.Total, a.Correct, a.Skipped, a.TimeTakenSec }).ToListAsync(ct);
            if (attempts.Count == 0) return Results.Ok(new { hasData = false });

            var cacheKey = $"ai-analysis:{uid}:{bank}:{attempts[^1].Id}";
            if (cache.TryGetValue(cacheKey, out JsonElement cached)) return Results.Ok(new { hasData = true, cached = true, report = cached });

            var rows = await db.AttemptAnswers
                .Where(x => x.Attempt.UserId == uid && x.Attempt.SubmittedAt != null && x.Attempt.BankId == bank)
                .Select(x => new { x.Question.Subject, x.Question.Topic, x.Question.Difficulty, x.IsCorrect, Skipped = x.Selected == null, x.TimeSec }).ToListAsync(ct);

            static double Pct(int a, int b) => b == 0 ? 0 : Math.Round(100.0 * a / b, 1);
            var stats = new
            {
                tests_taken = attempts.Count,
                questions_answered = rows.Count,
                overall_accuracy_percent = Pct(rows.Count(r => r.IsCorrect), rows.Count),
                skipped_percent = Pct(rows.Count(r => r.Skipped), rows.Count),
                avg_seconds_per_question = rows.Count == 0 ? 0 : Math.Round(rows.Average(r => r.TimeSec), 1),
                score_trend_percent_oldest_to_latest = attempts.TakeLast(12).Select(a => Pct(a.Correct, a.Total)).ToList(),
                subjects = rows.GroupBy(r => r.Subject).Select(g => new
                {
                    subject = g.Key, questions = g.Count(), accuracy_percent = Pct(g.Count(r => r.IsCorrect), g.Count()),
                    skipped_percent = Pct(g.Count(r => r.Skipped), g.Count()), avg_seconds = Math.Round(g.Average(r => r.TimeSec), 1),
                }).OrderBy(s => s.accuracy_percent).ToList(),
                // weakest and strongest topics (at least 2 questions) keep the payload small
                weakest_topics = rows.GroupBy(r => (r.Subject, r.Topic)).Where(g => g.Count() >= 2)
                    .Select(g => new { subject = g.Key.Subject, topic = g.Key.Topic, questions = g.Count(), accuracy_percent = Pct(g.Count(r => r.IsCorrect), g.Count()) })
                    .OrderBy(t => t.accuracy_percent).ThenByDescending(t => t.questions).Take(12).ToList(),
                strongest_topics = rows.GroupBy(r => (r.Subject, r.Topic)).Where(g => g.Count() >= 2)
                    .Select(g => new { subject = g.Key.Subject, topic = g.Key.Topic, questions = g.Count(), accuracy_percent = Pct(g.Count(r => r.IsCorrect), g.Count()) })
                    .OrderByDescending(t => t.accuracy_percent).ThenByDescending(t => t.questions).Take(5).ToList(),
                by_difficulty = rows.GroupBy(r => r.Difficulty).OrderBy(g => g.Key)
                    .Select(g => new { level = g.Key == 1 ? "easy" : g.Key == 2 ? "medium" : "hard", questions = g.Count(), accuracy_percent = Pct(g.Count(r => r.IsCorrect), g.Count()) }).ToList(),
            };

            var scope = bank is null ? "Official Police Bharti mock tests" : "The student's own custom question bank";
            try
            {
                var report = await ai.AnalyzeAsync(JsonSerializer.Serialize(stats), scope, ct);
                cache.Set(cacheKey, report, TimeSpan.FromDays(7));
                return Results.Ok(new { hasData = true, cached = false, report });
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "AI analysis failed");
                return Results.Json(new { error = "Could not write the AI analysis right now: " + e.Message }, statusCode: 502);
            }
        }).RequireAuthorization().RequireRateLimiting("aitest");
    }
}
