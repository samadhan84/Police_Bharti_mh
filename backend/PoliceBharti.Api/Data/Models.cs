using System.Text.Json;

namespace PoliceBharti.Api.Data;

/// <summary>A value in both languages, serialised as { "mr": ..., "en": ... }.</summary>
public record Bi<T>(T Mr, T En);
public static class BiExt
{
    public static Bi<string> Name(this Question q, bool topic) => topic ? new(q.TopicMr, q.Topic) : new(q.SubjectMr, q.Subject);
}

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Question
{
    public int Id { get; set; }
    /// <summary>Subject / Topic keys are English and used for grouping; *Mr columns hold the Marathi display names.</summary>
    public string Subject { get; set; } = "";
    public string SubjectMr { get; set; } = "";
    public string Topic { get; set; } = "";
    public string TopicMr { get; set; } = "";
    public string Text { get; set; } = "";       // English
    public string TextMr { get; set; } = "";     // Marathi
    public string OptionsJson { get; set; } = "[]";
    public string OptionsJsonMr { get; set; } = "[]";
    public int CorrectIndex { get; set; }
    public string Explanation { get; set; } = "";
    public string ExplanationMr { get; set; } = "";
    /// <summary>1 = easy, 2 = medium, 3 = hard</summary>
    public int Difficulty { get; set; } = 2;

    public string[] Options() => JsonSerializer.Deserialize<string[]>(OptionsJson) ?? [];
    public string[] OptionsMr() => JsonSerializer.Deserialize<string[]>(OptionsJsonMr) ?? [];
}

public class Attempt
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Mode { get; set; } = "full"; // full | subject
    public string? Subject { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public int DurationLimitSec { get; set; }
    public int TimeTakenSec { get; set; }
    public int Total { get; set; }
    public int Correct { get; set; }
    public int Wrong { get; set; }
    public int Skipped { get; set; }
    public List<AttemptAnswer> Answers { get; set; } = new();
}

public class AttemptAnswer
{
    public int Id { get; set; }
    public int AttemptId { get; set; }
    public Attempt Attempt { get; set; } = null!;
    public int QuestionId { get; set; }
    public Question Question { get; set; } = null!;
    public int Order { get; set; }
    public int? Selected { get; set; }
    public bool IsCorrect { get; set; }
    public int TimeSec { get; set; }
}
