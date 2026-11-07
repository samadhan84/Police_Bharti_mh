using Microsoft.EntityFrameworkCore;
using PoliceBharti.Api.Data;

namespace PoliceBharti.Api.Endpoints;

public static class AnalyticsEndpoints
{
    // Approximate General-category cut-off band quoted by coaching sites (out of 100 written marks). Not official.
    const int TargetPercent = 75;
    const int WeakBelow = 60;
    const int MinSample = 3;

    record Row(string Subject, string SubjectMr, string Topic, string TopicMr, int Difficulty, bool IsCorrect, bool Skipped, int TimeSec);

    public static void MapAnalytics(this WebApplication app)
    {
        app.MapGet("/api/analytics", async (HttpContext ctx, AppDbContext db, int? bank) =>
        {
            var uid = ctx.User.UserId();
            var attempts = await db.Attempts.Where(a => a.UserId == uid && a.SubmittedAt != null && a.BankId == bank)
                .OrderBy(a => a.SubmittedAt).ToListAsync();
            if (attempts.Count == 0) return Results.Ok(new { hasData = false });

            var rows = await db.AttemptAnswers
                .Where(x => x.Attempt.UserId == uid && x.Attempt.SubmittedAt != null && x.Attempt.BankId == bank)
                .Select(x => new Row(x.Question.Subject, x.Question.SubjectMr, x.Question.Topic, x.Question.TopicMr,
                    x.Question.Difficulty, x.IsCorrect, x.Selected == null, x.TimeSec)).ToListAsync();

            static double Pct(int a, int b) => b == 0 ? 0 : Math.Round(100.0 * a / b, 1);

            var custom = bank != null;
            var full = attempts.Where(a => custom || a.Mode == "full").ToList(); // for a custom bank every test counts as a "mock"
            var bankName = custom ? await db.CustomBanks.Where(b => b.Id == bank && b.UserId == uid).Select(b => b.Name).FirstOrDefaultAsync() : null;
            var trend = attempts.Select(a => new { a.Id, date = a.SubmittedAt, a.Mode, a.Subject, bankName, percent = Pct(a.Correct, a.Total) }).ToList();

            var subjects = rows.GroupBy(r => (r.Subject, r.SubjectMr)).Select(g => new
            {
                subject = g.Key.Subject, name = new Bi<string>(g.Key.SubjectMr, g.Key.Subject),
                total = g.Count(), correct = g.Count(r => r.IsCorrect), skipped = g.Count(r => r.Skipped),
                accuracy = Pct(g.Count(r => r.IsCorrect), g.Count()), avgTimeSec = Math.Round(g.Average(r => r.TimeSec), 1),
            }).OrderBy(s => s.accuracy).ToList();

            var topics = rows.GroupBy(r => (r.Subject, r.SubjectMr, r.Topic, r.TopicMr)).Select(g => new
            {
                subject = new Bi<string>(g.Key.SubjectMr, g.Key.Subject), topic = new Bi<string>(g.Key.TopicMr, g.Key.Topic),
                total = g.Count(), correct = g.Count(r => r.IsCorrect),
                accuracy = Pct(g.Count(r => r.IsCorrect), g.Count()), skipped = g.Count(r => r.Skipped),
            }).OrderBy(t => t.accuracy).ThenByDescending(t => t.total).ToList();

            var difficulty = rows.GroupBy(r => r.Difficulty).OrderBy(g => g.Key).Select(g => new
            {
                level = g.Key, total = g.Count(), accuracy = Pct(g.Count(r => r.IsCorrect), g.Count()),
            }).ToList();

            var weak = topics.Where(t => t.total >= MinSample && t.accuracy < WeakBelow).Take(8).ToList();
            var strong = topics.Where(t => t.total >= MinSample && t.accuracy >= 80).OrderByDescending(t => t.accuracy).Take(5).ToList();

            var overall = Pct(rows.Count(r => r.IsCorrect), rows.Count);
            var lastFull = full.LastOrDefault();
            var lastFullPct = lastFull is null ? (double?)null : Pct(lastFull.Correct, lastFull.Total);

            // ---- advice, written in Marathi and English ----
            var tips = new List<Bi<string>>();
            void Tip(string mr, string en) => tips.Add(new(mr, en));

            if (custom)
            {
                if (lastFullPct >= 80)
                    Tip($"तुमची शेवटची चाचणी {lastFullPct}% होती — उत्तम! कठीण प्रश्नांवर लक्ष द्या.", $"Your last test was {lastFullPct}% — great. Now focus on the harder questions.");
                else
                    Tip($"तुमची शेवटची चाचणी {lastFullPct}% होती. खालील कमजोर घटकांची उजळणी करा आणि पुन्हा चाचणी द्या.", $"Your last test was {lastFullPct}%. Revise the weak topics below, then retake the test.");
            }
            else if (lastFullPct is null)
                Tip("वेळेच्या मर्यादेत तुमची कामगिरी पाहण्यासाठी 100 प्रश्नांची पूर्ण सराव चाचणी द्या.",
                    "Take a full 100-question mock to see how you perform under real exam timing.");
            else if (lastFullPct >= TargetPercent)
                Tip($"तुमची शेवटची पूर्ण चाचणी ({lastFullPct}%) ~{TargetPercent}% च्या लक्ष्यावर किंवा त्यापुढे आहे. सातत्य राखण्यासाठी सराव चाचण्या देत रहा.",
                    $"Your last full mock ({lastFullPct}%) is at or above the ~{TargetPercent}% target. Keep taking mocks to stay consistent.");
            else
                Tip($"तुमची शेवटची पूर्ण चाचणी {lastFullPct}% होती. ~{TargetPercent}%+ चे लक्ष्य ठेवा (सुमारे {TargetPercent - lastFullPct:0.#} गुण अधिक) — सर्वसाधारण प्रवर्गाचा कट-ऑफ साधारणपणे 65–76 दरम्यान असतो व जिल्ह्यानुसार बदलतो.",
                    $"Your last full mock was {lastFullPct}%. Aim for ~{TargetPercent}%+ (about {TargetPercent - lastFullPct:0.#} points more) — cut-offs are usually in the 65–76 range for General category and vary by district.");

            foreach (var s in subjects.Where(s => s.total >= MinSample && s.accuracy < WeakBelow))
                Tip($"{s.name.Mr}: अचूकता फक्त {s.accuracy}% आहे. या विषयाला दररोज जास्त वेळ द्या.",
                    $"{s.name.En}: accuracy is only {s.accuracy}%. Give it extra daily practice time.");
            foreach (var t in weak)
                Tip($"'{t.topic.Mr}' ({t.subject.Mr}) ची उजळणी करा — {t.correct}/{t.total} बरोबर. संकल्पना पुन्हा वाचा आणि विषयनिहाय प्रश्नसंच सोडवा.",
                    $"Revise '{t.topic.En}' ({t.subject.En}) — {t.correct}/{t.total} correct. Re-read the concept, then practise a topic-wise set.");
            foreach (var s in subjects.Where(s => s.total >= 10 && Pct(s.skipped, s.total) > 20))
                Tip($"{s.name.Mr}: तुम्ही {Pct(s.skipped, s.total)}% प्रश्न सोडून देता. नकारात्मक गुणदान नसल्याने सर्व प्रश्न सोडवा.",
                    $"{s.name.En}: you skip {Pct(s.skipped, s.total)}% of questions. There is no negative marking, so always attempt every question.");
            foreach (var s in subjects.Where(s => s.total >= 10 && s.avgTimeSec > 70))
                Tip($"{s.name.Mr}: प्रति प्रश्न सरासरी {s.avgTimeSec:0} सेकंद लागतात, उपलब्ध ~54 सेकंदांपेक्षा जास्त. वेग वाढवण्याचा सराव करा (शॉर्टकट / पर्याय वगळण्याची पद्धत).",
                    $"{s.name.En}: average {s.avgTimeSec:0}s per question is above the ~54s available. Practise speed (shortcuts / elimination).");
            var easy = difficulty.FirstOrDefault(d => d.level == 1);
            if (easy is not null && easy.total >= 10 && easy.accuracy < 80)
                Tip($"तुमचे सोपे प्रश्न चुकत आहेत ({easy.accuracy}% अचूकता). वेगापेक्षा आधी अचूकता आणि काळजीपूर्वक वाचनावर भर द्या.",
                    $"You are missing easy questions ({easy.accuracy}% accuracy). Focus on accuracy and careful reading before attempting speed.");
            if (full.Count >= 3)
            {
                var d = Math.Round(Pct(full[^1].Correct, full[^1].Total) - Pct(full[0].Correct, full[0].Total), 1);
                if (d >= 0) Tip($"छान — पहिल्या चाचणीपासून तुमचा पूर्ण-चाचणी गुण {d} टक्क्यांनी वाढला आहे.", $"Great — your full-mock score improved by {d} points since your first mock.");
                else Tip($"तुमचा ताजा पूर्ण-चाचणी गुण पहिल्यापेक्षा {-d} टक्क्यांनी कमी आहे. अलीकडील चुका तपासा.", $"Your latest full-mock score is {-d} points below your first. Review recent mistakes.");
            }

            return Results.Ok(new
            {
                hasData = true, isCustom = custom, bankName,
                summary = new
                {
                    attempts = attempts.Count, fullMocks = full.Count, overallAccuracy = overall,
                    bestFullPercent = full.Count == 0 ? (double?)null : full.Max(a => Pct(a.Correct, a.Total)),
                    lastFullPercent = lastFullPct, targetPercent = TargetPercent, questionsAnswered = rows.Count,
                },
                trend, subjects, topics, difficulty, weak, strong, recommendations = tips,
            });
        }).RequireAuthorization();
    }
}
