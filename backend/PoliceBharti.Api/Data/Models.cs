using System.Text.Json;

namespace PoliceBharti.Api.Data;

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
    public string Subject { get; set; } = "";
    public string Topic { get; set; } = "";
    public string Text { get; set; } = "";
    public string OptionsJson { get; set; } = "[]";
    public int CorrectIndex { get; set; }
    public string Explanation { get; set; } = "";
    /// <summary>1 = easy, 2 = medium, 3 = hard</summary>
    public int Difficulty { get; set; } = 2;

    public string[] Options() => JsonSerializer.Deserialize<string[]>(OptionsJson) ?? [];
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
