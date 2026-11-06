using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PoliceBharti.Api.Data;
using PoliceBharti.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

var conn = builder.Configuration.GetConnectionString("Default")!;
builder.Services.AddDbContext<AppDbContext>(o => o.UseMySql(conn, new MySqlServerVersion(new Version(8, 0, 0))));

var jwtKey = builder.Configuration["Jwt:Key"]!;
if (!builder.Environment.IsDevelopment() && jwtKey.StartsWith("CHANGE_ME"))
    throw new InvalidOperationException("Set Jwt__Key to a strong secret in production.");

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
builder.Services.AddAuthorization();
// Bearer-token auth (no cookies), so open CORS is safe and lets web, Electron and Capacitor clients connect.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await Seeder.RunAsync(db, Path.Combine(AppContext.BaseDirectory, "SeedData"));
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapAuth();
app.MapAttempts();
app.MapAnalytics();

app.Run();

public partial class Program;
