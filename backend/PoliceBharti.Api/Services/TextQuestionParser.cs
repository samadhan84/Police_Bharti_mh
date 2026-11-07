using System.Text.RegularExpressions;

namespace PoliceBharti.Api.Services;

/// <summary>One multiple-choice question in the shape the custom-bank feature uses (single language, 4 options).</summary>
public class ParsedQuestion
{
    public string Subject { get; set; } = "";
    public string SubjectMr { get; set; } = "";
    public string Topic { get; set; } = "";
    public string TopicMr { get; set; } = "";
    public int Difficulty { get; set; } = 2;
    public string Text { get; set; } = "";
    public string[] Options { get; set; } = [];
    public int Correct { get; set; } = -1;
    public string Explanation { get; set; } = "";
    /// <summary>true = the answer came from the uploaded file; false = guessed/solved by AI (user should verify).</summary>
    public bool AnswerFromSource { get; set; } = true;
}

/// <summary>
/// Offline parser for plain text, used when no AI key is configured (or the AI call fails).
/// Understands the usual layout:
///   1. Question text            (also "Q1)", "प्र.1")
///   A) option  B) option ...    (also a. / (a) / अ) ब) क) ड) )
///   Answer: B                   (also "Ans", "Correct answer", "उत्तर")
/// It cannot classify subject/topic/difficulty - that needs the AI path.
/// </summary>
public static class TextQuestionParser
{
    static readonly Regex QStart = new(@"^\s*(?:Q\.?|प्र\.?|प्रश्न)?\s*\(?\d{1,4}\s*[\.\)\-:]\s*(?<t>\S.*)$", RegexOptions.IgnoreCase);
    static readonly Regex Opt = new(@"^\s*\(?(?<l>[A-Da-dअबकड])\s*[\)\.\:]\s*(?<t>\S.*)$");
    static readonly Regex Ans = new(@"^\s*(?:answer|ans|correct(?:\s+answer)?|उत्तर)\s*[:\-\.]?\s*\(?(?<l>[A-Da-dअबकड])\b", RegexOptions.IgnoreCase);
    static readonly Regex Expl = new(@"^\s*(?:explanation|solution|स्पष्टीकरण|स्पष्टिकरण)\s*[:\-\.]\s*(?<t>.*)$", RegexOptions.IgnoreCase);

    static int Letter(string l) => l.ToUpperInvariant() switch
    {
        "A" or "अ" => 0, "B" or "ब" => 1, "C" or "क" => 2, "D" or "ड" => 3, _ => -1,
    };

    public static List<ParsedQuestion> Parse(string text, string subject = "General", string subjectMr = "सामान्य")
    {
        var result = new List<ParsedQuestion>();
        ParsedQuestion? cur = null;
        var opts = new string?[4];
        string field = "q"; int optIdx = -1;

        void Flush()
        {
            if (cur is null) return;
            cur.Text = cur.Text.Trim(); cur.Explanation = cur.Explanation.Trim();
            if (cur.Text != "" && opts.All(o => !string.IsNullOrWhiteSpace(o)))
            {
                cur.Options = opts.Select(o => o!.Trim()).ToArray();
                cur.Subject = subject; cur.SubjectMr = subjectMr; cur.Topic = subject; cur.TopicMr = subjectMr;
                result.Add(cur);
            }
            cur = null; Array.Clear(opts); field = "q"; optIdx = -1;
        }

        foreach (var raw in text.Replace("\r", "").Split('\n'))
        {
            var line = raw.Trim();
            if (line == "") continue;

            if (cur is not null && Ans.Match(line) is { Success: true } am)
            { cur.Correct = Letter(am.Groups["l"].Value); field = "a"; continue; }
            if (cur is not null && Expl.Match(line) is { Success: true } em)
            { cur.Explanation = em.Groups["t"].Value; field = "e"; continue; }
            if (cur is not null && field != "e" && Opt.Match(line) is { Success: true } om && Letter(om.Groups["l"].Value) is var li and >= 0
                && (opts[li] is null))
            { optIdx = li; opts[li] = om.Groups["t"].Value; field = "o"; continue; }
            // a new numbered question starts only once the previous one has options (so "1." inside text is not a split)
            if (QStart.Match(line) is { Success: true } qm && (cur is null || opts.Any(o => o is not null)))
            {
                Flush();
                cur = new ParsedQuestion { Text = qm.Groups["t"].Value };
                continue;
            }
            if (cur is null) continue;
            // continuation of the current field
            switch (field)
            {
                case "q": cur.Text += " " + line; break;
                case "o": opts[optIdx] += " " + line; break;
                case "e": cur.Explanation += " " + line; break;
            }
        }
        Flush();
        return result;
    }
}
