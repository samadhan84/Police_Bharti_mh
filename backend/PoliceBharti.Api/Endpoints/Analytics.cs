using Microsoft.EntityFrameworkCore;
using PoliceBharti.Api.Data;

namespace PoliceBharti.Api.Endpoints;

public static class AnalyticsEndpoints
{
    // Approximate General-category cut-off band quoted by coaching sites (out of 100 written marks). Not official.
    const int TargetPercent = 75;
    const int WeakBelow = 60;
    const int MinSample = 3;

    record Row(string Subject, string Topic, int Difficulty, bool IsCorrect, bool Skipped, int TimeSec);

    public static void MapAnalytics(this WebApplication app)
    {
        app.MapGet("/api/analytics", async (HttpContext ctx, AppDbContext db) =>
        {
            var uid = ctx.User.UserId();
            var attempts = await db.Attempts.Where(a => a.UserId == uid && a.SubmittedAt != null)
                .OrderBy(a => a.SubmittedAt).ToListAsync();

            var rows = await db.AttemptAnswers
                .Where(x => x.Attempt.UserId == uid && x.Attempt.SubmittedAt != null)
                .Select(x => new Row(x.Question.Subject, x.Question.Topic, x.Question.Difficulty,
                    x.IsCorrect, x.Selected == null, x.TimeSec)).ToListAsync();

            if (attempts.Count == 0)
                return Results.Ok(new { hasData = false });

            static double Pct(int a, int b) => b == 0 ? 0 : Math.Round(100.0 * a / b, 1);

            var full = attempts.Where(a => a.Mode == "full").ToList();
            var trend = attempts.Select(a => new { a.Id, date = a.SubmittedAt, a.Mode, a.Subject, percent = Pct(a.Correct, a.Total) }).ToList();

            var subjects = rows.GroupBy(r => r.Subject).Select(g => new
            {
                subject = g.Key, total = g.Count(), correct = g.Count(r => r.IsCorrect),
                skipped = g.Count(r => r.Skipped), accuracy = Pct(g.Count(r => r.IsCorrect), g.Count()),
                avgTimeSec = Math.Round(g.Average(r => r.TimeSec), 1),
            }).OrderBy(s => s.accuracy).ToList();

            var topics = rows.GroupBy(r => (r.Subject, r.Topic)).Select(g => new
            {
                subject = g.Key.Subject, topic = g.Key.Topic, total = g.Count(),
                correct = g.Count(r => r.IsCorrect), accuracy = Pct(g.Count(r => r.IsCorrect), g.Count()),
                skipped = g.Count(r => r.Skipped),
            }).OrderBy(t => t.accuracy).ThenByDescending(t => t.total).ToList();

            var difficulty = rows.GroupBy(r => r.Difficulty).OrderBy(g => g.Key).Select(g => new
            {
                level = g.Key == 1 ? "Easy" : g.Key == 2 ? "Medium" : "Hard",
                total = g.Count(), accuracy = Pct(g.Count(r => r.IsCorrect), g.Count()),
            }).ToList();

            var weak = topics.Where(t => t.total >= MinSample && t.accuracy < WeakBelow).Take(8).ToList();
            var strong = topics.Where(t => t.total >= MinSample && t.accuracy >= 80).OrderByDescending(t => t.accuracy).Take(5).ToList();

            var overall = Pct(rows.Count(r => r.IsCorrect), rows.Count);
            var lastFull = full.LastOrDefault();
            var lastFullPct = lastFull is null ? (double?)null : Pct(lastFull.Correct, lastFull.Total);

            // ---- advice ----
            var tips = new List<string>();
            if (lastFullPct is null)
                tips.Add("Take a full 100-question mock to see how you perform under real exam timing.");
            else if (lastFullPct >= TargetPercent)
                tips.Add($"Your last full mock ({lastFullPct}%) is at or above the ~{TargetPercent}% target. Keep taking mocks to stay consistent.");
            else
                tips.Add($"Your last full mock was {lastFullPct}%. Aim for ~{TargetPercent}%+ (about {TargetPercent - lastFullPct:0.#} points more) — cut-offs are usually in the 65–76 range for General category and vary by district.");

            foreach (var s in subjects.Where(s => s.total >= MinSample && s.accuracy < WeakBelow))
                tips.Add($"{s.subject}: accuracy is only {s.accuracy}%. Give it extra daily practice time.");
            foreach (var t in weak)
                tips.Add($"Revise '{t.topic}' ({t.subject}) — {t.correct}/{t.total} correct. Re-read the concept, then practise a topic-wise set.");
            foreach (var s in subjects.Where(s => s.total >= 10 && Pct(s.skipped, s.total) > 20))
                tips.Add($"{s.subject}: you skip {Pct(s.skipped, s.total)}% of questions. There is no negative marking, so always attempt every question.");
            var slow = subjects.Where(s => s.total >= 10 && s.avgTimeSec > 70).ToList();
            foreach (var s in slow)
                tips.Add($"{s.subject}: average {s.avgTimeSec:0}s per question is above the ~54s available. Practise speed (shortcuts / elimination).");
            var hard = difficulty.FirstOrDefault(d => d.level == "Easy");
            if (hard is not null && hard.total >= 10 && hard.accuracy < 80)
                tips.Add($"You are missing easy questions ({hard.accuracy}% accuracy). Focus on accuracy and careful reading before attempting speed.");
            if (full.Count >= 3)
            {
                var d = Pct(full[^1].Correct, full[^1].Total) - Pct(full[0].Correct, full[0].Total);
                tips.Add(d >= 0 ? $"Great — your full-mock score improved by {d:0.#} points since your first mock." : $"Your latest full-mock score is {-d:0.#} points below your first. Review recent mistakes.");
            }

            return Results.Ok(new
            {
                hasData = true,
                summary = new
                {
                    attempts = attempts.Count, fullMocks = full.Count,
                    overallAccuracy = overall,
                    bestFullPercent = full.Count == 0 ? (double?)null : full.Max(a => Pct(a.Correct, a.Total)),
                    lastFullPercent = lastFullPct, targetPercent = TargetPercent,
                    questionsAnswered = rows.Count,
                },
                trend, subjects, topics, difficulty, weak, strong, recommendations = tips,
            });
        }).RequireAuthorization();
    }
}
