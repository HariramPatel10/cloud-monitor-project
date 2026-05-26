var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/", () => "Azure Monitoring Dashboard Running");

app.MapGet("/error", () =>
{
    return Results.BadRequest("Simulated Error");
});

app.MapGet("/slow", async () =>
{
    await Task.Delay(5000);
    return "Slow Response";
});

app.Run();
