using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace PoliceBharti.Api.Data;

public static class Seeder
{
    static readonly JsonSerializerOptions Json = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    // questions.json row : [topic, text, correct, wrong1, wrong2, wrong3, explanation, difficulty]
    //   (English for Arithmetic / Reasoning / GK, Marathi for Marathi Grammar)
    // translations.json  : [text, correct, wrong1, wrong2, wrong3, explanation]  in the OTHER language
    // names.json         : subject / topic display names as [english, marathi]
    // The correct answer is listed first; options are shuffled with one seeded permutation applied to
    // both languages, so the correct index is identical in Marathi and English.
    public static async Task RunAsync(AppDbContext db, string dir)
    {
        await db.Database.EnsureCreatedAsync();
        if (await db.Questions.AnyAsync()) return;

        var q = Load<Dictionary<string, List<JsonElement[]>>>(Path.Combine(dir, "questions.json"));
        var tr = Load<Dictionary<string, List<string[]>>>(Path.Combine(dir, "translations.json"));
        var names = Load<Dictionary<string, Dictionary<string, string[]>>>(Path.Combine(dir, "names.json"));
        var rng = new Random(2026);

        foreach (var (subject, rows) in q)
        for (var i = 0; i < rows.Count; i++)
        {
            var r = rows[i]; var t = tr[subject][i];
            var baseOpts = new[] { r[2].GetString()!, r[3].GetString()!, r[4].GetString()!, r[5].GetString()! };
            var order = Enumerable.Range(0, 4).OrderBy(_ => rng.Next()).ToArray();
            string[] Shuffle(string[] o) => order.Select(k => o[k]).ToArray();
            var baseText = r[1].GetString()!; var baseExpl = r[6].GetString()!;
            var trOpts = new[] { t[1], t[2], t[3], t[4] };
            var baseIsMarathi = subject == "Marathi Grammar";
            var topicKey = r[0].GetString()!;

            db.Questions.Add(new Question
            {
                Subject = subject, SubjectMr = names["subjects"][subject][1],
                Topic = names["topics"][topicKey][0], TopicMr = names["topics"][topicKey][1],
                Text = baseIsMarathi ? t[0] : baseText, TextMr = baseIsMarathi ? baseText : t[0],
                OptionsJson = JsonSerializer.Serialize(Shuffle(baseIsMarathi ? trOpts : baseOpts), Json),
                OptionsJsonMr = JsonSerializer.Serialize(Shuffle(baseIsMarathi ? baseOpts : trOpts), Json),
                CorrectIndex = Array.IndexOf(order, 0),
                Explanation = baseIsMarathi ? t[5] : baseExpl, ExplanationMr = baseIsMarathi ? baseExpl : t[5],
                Difficulty = r[7].GetInt32(),
            });
        }
        await db.SaveChangesAsync();
    }

    static T Load<T>(string path) => JsonSerializer.Deserialize<T>(File.ReadAllText(path))!;
}
