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
    public static async Task RunAsync(AppDbContext db, string dir, string? csvPath = null)
    {
        await db.Database.EnsureCreatedAsync();
        await UpgradeAsync(db);
        if (await db.Questions.AnyAsync(q => q.BankId == null)) return;

        // Seed__CsvPath=/path/questions.csv -> load questions from a CSV (admin-template format) instead of the built-in set.
        if (!string.IsNullOrWhiteSpace(csvPath))
        {
            await SeedFromCsvAsync(db, dir, csvPath);
            return;
        }

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

    /// <summary>
    /// EnsureCreated never alters an existing database, so databases created before the "custom bank" feature
    /// get the new table/columns here. Every statement is idempotent (a failure just means it already exists).
    /// </summary>
    static async Task UpgradeAsync(AppDbContext db)
    {
        string[] sql = db.Database.IsSqlite()
            ?
            [
                "CREATE TABLE IF NOT EXISTS CustomBanks (Id INTEGER PRIMARY KEY AUTOINCREMENT, UserId INTEGER NOT NULL, Name TEXT NOT NULL, CreatedAt TEXT NOT NULL)",
                "CREATE INDEX IF NOT EXISTS IX_CustomBanks_UserId ON CustomBanks (UserId)",
                "ALTER TABLE Questions ADD COLUMN BankId INTEGER NULL",
                "ALTER TABLE Attempts ADD COLUMN BankId INTEGER NULL",
            ]
            :
            [
                "CREATE TABLE IF NOT EXISTS CustomBanks (Id INT AUTO_INCREMENT PRIMARY KEY, UserId INT NOT NULL, Name VARCHAR(120) NOT NULL, CreatedAt DATETIME(6) NOT NULL, INDEX IX_CustomBanks_UserId (UserId))",
                "ALTER TABLE Questions ADD COLUMN BankId INT NULL",
                "ALTER TABLE Attempts ADD COLUMN BankId INT NULL",
                "CREATE INDEX IX_Questions_BankId ON Questions (BankId)",
            ];
        foreach (var stmt in sql)
        {
            try { await db.Database.ExecuteSqlRawAsync(stmt); }
            catch { /* already applied */ }
        }
    }

    static async Task SeedFromCsvAsync(AppDbContext db, string dir, string csvPath)
    {
        if (!File.Exists(csvPath)) throw new FileNotFoundException("Seed:CsvPath not found: " + csvPath);
        var names = Load<Dictionary<string, Dictionary<string, string[]>>>(Path.Combine(dir, "names.json"));
        var subjects = names["subjects"].ToDictionary(k => k.Key, v => v.Value[1], StringComparer.OrdinalIgnoreCase);
        var rows = Endpoints.AdminEndpoints.Parse("csv", File.ReadAllText(csvPath));
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int ok = 0, bad = 0;
        for (var i = 0; i < rows.Count; i++)
        {
            var (q, errors) = Endpoints.AdminEndpoints.Build(rows[i], subjects);
            if (q is null) { bad++; Console.WriteLine($"[seed] row {i + 1} skipped: {string.Join("; ", errors)}"); continue; }
            if (!seen.Add(q.Subject + "|" + q.Text + "|" + q.OptionsJson)) { bad++; Console.WriteLine($"[seed] row {i + 1} skipped: duplicate"); continue; }
            db.Questions.Add(q); ok++;
        }
        await db.SaveChangesAsync();
        Console.WriteLine($"[seed] loaded {ok} questions from {csvPath} ({bad} skipped)");
    }

    static T Load<T>(string path) => JsonSerializer.Deserialize<T>(File.ReadAllText(path))!;
}
