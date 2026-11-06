using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace PoliceBharti.Api.Data;

public static class Seeder
{
    // Row: [topic, text, correctAnswer, wrong1, wrong2, wrong3, explanation, difficulty]
    // The correct answer is listed first and options are shuffled with a seeded RNG,
    // so the answer position is unbiased but the DB content is deterministic.
    public static async Task RunAsync(AppDbContext db, string path)
    {
        await db.Database.EnsureCreatedAsync();
        if (await db.Questions.AnyAsync() || !File.Exists(path)) return;

        var data = JsonSerializer.Deserialize<Dictionary<string, List<JsonElement[]>>>(File.ReadAllText(path))!;
        var rng = new Random(2026);
        foreach (var (subject, rows) in data)
        foreach (var r in rows)
        {
            var opts = new[] { r[2].GetString()!, r[3].GetString()!, r[4].GetString()!, r[5].GetString()! };
            var order = Enumerable.Range(0, 4).OrderBy(_ => rng.Next()).ToArray();
            var shuffled = order.Select(i => opts[i]).ToArray();
            db.Questions.Add(new Question
            {
                Subject = subject,
                Topic = r[0].GetString()!,
                Text = r[1].GetString()!,
                OptionsJson = JsonSerializer.Serialize(shuffled, new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }),
                CorrectIndex = Array.IndexOf(order, 0),
                Explanation = r[6].GetString()!,
                Difficulty = r[7].GetInt32(),
            });
        }
        await db.SaveChangesAsync();
    }
}
