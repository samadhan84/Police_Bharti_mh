using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PoliceBharti.Api.Data;

namespace PoliceBharti.Api.Endpoints;

public record RegisterDto(string Name, string Email, string Password);
public record LoginDto(string Email, string Password);

public static class AuthEndpoints
{
    public static int UserId(this ClaimsPrincipal p) => int.Parse(p.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static void MapAuth(this WebApplication app)
    {
        var g = app.MapGroup("/api/auth");

        g.MapPost("/register", async (RegisterDto dto, AppDbContext db, IConfiguration cfg) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant() ?? "";
            if (string.IsNullOrWhiteSpace(dto.Name) || !email.Contains('@') || (dto.Password?.Length ?? 0) < 6)
                return Results.BadRequest(new { error = "Name, valid email and password (min 6 chars) are required." });
            if (await db.Users.AnyAsync(u => u.Email == email))
                return Results.Conflict(new { error = "Email already registered." });

            var user = new User { Name = dto.Name.Trim(), Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password) };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return Results.Ok(new { token = Token(user, cfg), name = user.Name, email = user.Email, isAdmin = IsAdmin(user.Email, cfg) });
        });

        g.MapPost("/login", async (LoginDto dto, AppDbContext db, IConfiguration cfg) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant() ?? "";
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user is null || !BCrypt.Net.BCrypt.Verify(dto.Password ?? "", user.PasswordHash))
                return Results.Json(new { error = "Invalid email or password." }, statusCode: 401);
            return Results.Ok(new { token = Token(user, cfg), name = user.Name, email = user.Email, isAdmin = IsAdmin(user.Email, cfg) });
        });
    }

    /// <summary>Admins are the emails listed in config key Admin:Emails (env: Admin__Emails__0, Admin__Emails__1, ...).</summary>
    public static bool IsAdmin(string email, IConfiguration cfg) =>
        (cfg.GetSection("Admin:Emails").Get<string[]>() ?? []).Any(a => a.Trim().Equals(email, StringComparison.OrdinalIgnoreCase));

    static string Token(User u, IConfiguration cfg)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!));
        var jwt = new JwtSecurityToken(
            issuer: cfg["Jwt:Issuer"],
            claims: [new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()), new Claim(ClaimTypes.Name, u.Name),
                     .. IsAdmin(u.Email, cfg) ? [new Claim(ClaimTypes.Role, "Admin")] : Array.Empty<Claim>()],
            expires: DateTime.UtcNow.AddHours(cfg.GetValue("Jwt:ExpiryHours", 12)),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
}
