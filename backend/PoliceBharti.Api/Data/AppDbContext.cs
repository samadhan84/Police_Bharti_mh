using Microsoft.EntityFrameworkCore;

namespace PoliceBharti.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Attempt> Attempts => Set<Attempt>();
    public DbSet<AttemptAnswer> AttemptAnswers => Set<AttemptAnswer>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<User>().Property(u => u.Email).HasMaxLength(190);
        b.Entity<Question>().HasIndex(q => new { q.Subject, q.Topic });
        b.Entity<Question>().Property(q => q.Subject).HasMaxLength(60);
        b.Entity<Question>().Property(q => q.Topic).HasMaxLength(80);
        b.Entity<Question>().Property(q => q.SubjectMr).HasMaxLength(100);
        b.Entity<Question>().Property(q => q.TopicMr).HasMaxLength(100);
        b.Entity<Attempt>().HasIndex(a => a.UserId);
        b.Entity<Attempt>().Property(a => a.Subject).HasMaxLength(60);
        b.Entity<AttemptAnswer>().HasIndex(a => new { a.AttemptId, a.QuestionId }).IsUnique();
    }
}
