using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PoliceBharti.Api.Data;
using PoliceBharti.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Hosts such as Railway/Render tell the app which port to listen on via $PORT.
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Connection string: ConnectionStrings__Default, or Railway's MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE.
var conn = builder.Configuration.GetConnectionString("Default")!;
if (Environment.GetEnvironmentVariable("MYSQLHOST") is { Length: > 0 } mh)
    conn = $"Server={mh};Port={Environment.GetEnvironmentVariable("MYSQLPORT") ?? "3306"};Database={Environment.GetEnvironmentVariable("MYSQLDATABASE")};" +
           $"User={Environment.GetEnvironmentVariable("MYSQLUSER")};Password={Environment.GetEnvironmentVariable("MYSQLPASSWORD")};";
// Database__Provider=sqlite -> single local file, no MySQL needed (for quick testing). Default is MySQL.
var useSqlite = string.Equals(builder.Configuration["Database:Provider"], "sqlite", StringComparison.OrdinalIgnoreCase);
builder.Services.AddDbContext<AppDbContext>(o =>
{
    if (useSqlite) o.UseSqlite("Data Source=" + (builder.Configuration["Database:SqlitePath"] ?? "policebharti-test.db"));
    else o.UseMySql(conn, new MySqlServerVersion(new Version(8, 0, 0)));
});

var jwtKey = builder.Configuration["Jwt:Key"]!;
if (!builder.Environment.IsDevelopment() && (jwtKey.StartsWith("CHANGE_ME") || jwtKey.Length < 32))
    throw new InvalidOperationException("Set Jwt__Key to a random secret of at least 32 characters in production.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidateLifetime = true,
    };
});
builder.Services.AddAuthorization(o => o.AddPolicy("Admin", p => p.RequireRole("Admin")));
// Bearer-token auth (no cookies), so open CORS is safe and lets web, Electron and Capacitor clients connect.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

// Behind the host's HTTPS proxy: trust X-Forwarded-* so client IPs (rate limiting) and scheme are correct.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear(); o.KnownProxies.Clear();
});
// Slow down password guessing: 20 login/register calls per minute per IP.
builder.Services.AddSingleton<PoliceBharti.Api.Services.QuestionExtractor>();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
    // Custom-bank uploads can call the paid AI reader: 15 per 10 minutes per IP.
    o.AddPolicy("upload", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(10) }));
    // AI tests / AI analysis cost money: 12 per hour per signed-in student (falls back to the IP).
    o.AddPolicy("aitest", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 12, Window = TimeSpan.FromHours(1) }));
});
builder.Services.AddMemoryCache();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await Seeder.RunAsync(db, Path.Combine(AppContext.BaseDirectory, "SeedData"), builder.Configuration["Seed:CsvPath"]);
}

app.UseForwardedHeaders();
app.UseDefaultFiles();   // serves the built React app from wwwroot (production container)
app.UseStaticFiles();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();    // after authentication so per-student limits can see who is calling

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapAuth();
app.MapAttempts();
app.MapAnalytics();
app.MapAdmin();
app.MapCustom();
app.MapAiTest();
app.MapAiAnalytics();
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
