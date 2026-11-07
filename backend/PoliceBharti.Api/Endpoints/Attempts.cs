using Microsoft.EntityFrameworkCore;
using PoliceBharti.Api.Data;

namespace PoliceBharti.Api.Endpoints;

public record StartDto(string Mode, string? Subject, int? Count, int? BankId = null);
public record AnswerDto(int QuestionId, int? Selected, int TimeSec);
public record SubmitDto(List<AnswerDto> Answers, int TimeTakenSec);

public static class AttemptEndpoints
{
    // Pattern of the Maharashtra Police Bharti written test: 100 marks, 90 minutes, 4 subjects x 25.
    public const int FullPerSubject = 25;
    public const int FullMinutes = 90;

    public static void MapAttempts(this WebApplication app)
    {
        var g = app.MapGroup("/api").RequireAuthorization();

        g.MapGet("/subjects", async (AppDbContext db) =>
            await db.Questions.Where(q => q.BankId == null).GroupBy(q => new { q.Subject, q.SubjectMr })
                .Select(x => new { subject = x.Key.Subject, name = new Bi<string>(x.Key.SubjectMr, x.Key.Subject), questions = x.Count() }).ToListAsync());

        g.MapPost("/attempts", async (StartDto dto, HttpContext ctx, AppDbContext db) =>
        {
            var rng = new Random();
            List<Question> picked;
            int limitSec;
            int? bankId = null;
            if (dto.Mode == "custom")
            {
                var uid = ctx.User.UserId();
                var bank = dto.BankId is null ? null : await db.CustomBanks.FirstOrDefaultAsync(b => b.Id == dto.BankId && b.UserId == uid);
                if (bank is null) return Results.BadRequest(new { error = "Question bank not found." });
                var pool = await db.Questions.Where(q => q.BankId == bank.Id && (string.IsNullOrEmpty(dto.Subject) || q.Subject == dto.Subject)).ToListAsync();
                if (pool.Count == 0) return Results.BadRequest(new { error = "No questions in this bank." });
                var count = Math.Clamp(dto.Count ?? Math.Min(pool.Count, 25), 1, Math.Min(pool.Count, 100));
                picked = pool.OrderBy(_ => rng.Next()).Take(count).ToList();
                limitSec = picked.Count * 60;
                bankId = bank.Id;
            }
            else if (dto.Mode == "subject")
            {
                if (string.IsNullOrWhiteSpace(dto.Subject)) return Results.BadRequest(new { error = "Subject required." });
                var count = Math.Clamp(dto.Count ?? 15, 5, 50);
                var pool = await db.Questions.Where(q => q.BankId == null && q.Subject == dto.Subject).ToListAsync();
                if (pool.Count == 0) return Results.BadRequest(new { error = "Unknown subject." });
                picked = pool.OrderBy(_ => rng.Next()).Take(count).ToList();
                limitSec = picked.Count * 54; // 90 min / 100 q
            }
            else
            {
                var all = await db.Questions.Where(q => q.BankId == null).ToListAsync();
                picked = all.GroupBy(q => q.Subject)
                    .SelectMany(s => s.OrderBy(_ => rng.Next()).Take(FullPerSubject)).ToList();
                // keep sections together (as in the real paper), shuffle inside each section
                picked = picked.GroupBy(q => q.Subject).SelectMany(s => s.OrderBy(_ => rng.Next())).ToList();
                limitSec = FullMinutes * 60;
            }

            var attempt = new Attempt
            {
                UserId = ctx.User.UserId(), Mode = dto.Mode is "subject" or "custom" ? dto.Mode : "full",
                Subject = dto.Mode is "subject" or "custom" && !string.IsNullOrEmpty(dto.Subject) ? dto.Subject : null,
                BankId = bankId,
                DurationLimitSec = limitSec, Total = picked.Count,
                Answers = picked.Select((q, i) => new AttemptAnswer { QuestionId = q.Id, Order = i }).ToList(),
            };
            db.Attempts.Add(attempt);
            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                attemptId = attempt.Id, durationSec = limitSec, startedAt = attempt.StartedAt,
                questions = picked.Select(q => new
                {
                    q.Id, subject = q.Subject, subjectName = q.Name(false), topic = q.Name(true),
                    text = new Bi<string>(q.TextMr, q.Text), options = new Bi<string[]>(q.OptionsMr(), q.Options()),
                }),
            });
        });

        g.MapPost("/attempts/{id:int}/submit", async (int id, SubmitDto dto, HttpContext ctx, AppDbContext db) =>
        {
            var a = await db.Attempts.Include(x => x.Answers).ThenInclude(x => x.Question)
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == ctx.User.UserId());
            if (a is null) return Results.NotFound();
            if (a.SubmittedAt is not null) return Results.Conflict(new { error = "Already submitted." });

            var given = (dto.Answers ?? []).GroupBy(x => x.QuestionId).ToDictionary(x => x.Key, x => x.Last());
            foreach (var ans in a.Answers)
            {
                given.TryGetValue(ans.QuestionId, out var d);
                var sel = d?.Selected is >= 0 and < 4 ? d.Selected : null;
                ans.Selected = sel;
                ans.TimeSec = Math.Clamp(d?.TimeSec ?? 0, 0, 3600);
                ans.IsCorrect = sel == ans.Question.CorrectIndex;
            }
            a.Correct = a.Answers.Count(x => x.IsCorrect);
            a.Skipped = a.Answers.Count(x => x.Selected is null);
            a.Wrong = a.Total - a.Correct - a.Skipped;
            a.SubmittedAt = DateTime.UtcNow;
            a.TimeTakenSec = Math.Clamp(dto.TimeTakenSec, 0, a.DurationLimitSec + 60);
            await db.SaveChangesAsync();
            return Results.Ok(new { attemptId = a.Id });
        });

        g.MapGet("/attempts", async (HttpContext ctx, AppDbContext db) =>
        {
            var uid = ctx.User.UserId();
            return await db.Attempts.Where(a => a.UserId == uid && a.SubmittedAt != null)
                .OrderByDescending(a => a.SubmittedAt)
                .Select(a => new
                {
                    a.Id, a.Mode, a.Subject, a.SubmittedAt, a.Total, a.Correct, a.Wrong, a.Skipped, a.TimeTakenSec,
                    bankName = db.CustomBanks.Where(b => b.Id == a.BankId).Select(b => b.Name).FirstOrDefault(),
                })
                .ToListAsync();
        });

        g.MapGet("/attempts/{id:int}", async (int id, HttpContext ctx, AppDbContext db) =>
        {
            var uid = ctx.User.UserId();
            var a = await db.Attempts.Include(x => x.Answers).ThenInclude(x => x.Question)
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == uid && x.SubmittedAt != null);
            if (a is null) return Results.NotFound();
            return Results.Ok(new
            {
                a.Id, a.Mode, a.Subject, a.SubmittedAt, a.Total, a.Correct, a.Wrong, a.Skipped, a.TimeTakenSec,
                bankName = await db.CustomBanks.Where(b => b.Id == a.BankId).Select(b => b.Name).FirstOrDefaultAsync(),
                bySubject = a.Answers.GroupBy(x => x.Question.Subject).Select(s => new
                {
                    subject = s.Key, name = s.First().Question.Name(false), total = s.Count(), correct = s.Count(x => x.IsCorrect),
                }),
                review = a.Answers.OrderBy(x => x.Order).Select(x => new
                {
                    questionId = x.QuestionId, subject = x.Question.Name(false), topic = x.Question.Name(true),
                    text = new Bi<string>(x.Question.TextMr, x.Question.Text),
                    options = new Bi<string[]>(x.Question.OptionsMr(), x.Question.Options()),
                    selected = x.Selected, correct = x.Question.CorrectIndex, isCorrect = x.IsCorrect,
                    explanation = new Bi<string>(x.Question.ExplanationMr, x.Question.Explanation), timeSec = x.TimeSec,
                }),
            });
        });
    }
}
