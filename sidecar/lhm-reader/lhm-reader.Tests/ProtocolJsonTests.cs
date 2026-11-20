using System.Collections.Generic;
using System.Text.Json;
using Xunit;

namespace LhmReader.Tests;

public sealed class ProtocolJsonTests
{
    [Fact]
    public void missing_driver_snapshot_serialises_explicit_nulls()
    {
        var snapshot = new CpuReadSnapshot
        {
            Name = "Intel Core i7-3770K",
            Driver = "missing",
            Cores = new List<CpuCoreSnapshot>
            {
                new() { Index = 0 },
                new() { Index = 1 },
                new() { Index = 2 },
                new() { Index = 3 },
            },
        };

        var json = ProtocolJson.SerializeSuccess(snapshot);
        using var doc = JsonDocument.Parse(json);
        var cpu = doc.RootElement.GetProperty("cpu");
        Assert.Equal(JsonValueKind.Null, cpu.GetProperty("packageTempC").ValueKind);
        Assert.Equal(JsonValueKind.Null, cpu.GetProperty("packagePowerW").ValueKind);
        Assert.Equal("missing", cpu.GetProperty("driver").GetString());
        var core0 = cpu.GetProperty("cores")[0];
        Assert.Equal(JsonValueKind.Null, core0.GetProperty("tempC").ValueKind);
        Assert.Equal(JsonValueKind.Null, core0.GetProperty("clockMHz").ValueKind);
    }
}