using System.Collections.Generic;
using System.Text.Json;
using Xunit;

namespace LhmReader.Tests;

public sealed class ProtocolJsonTests
{
    [Fact]
    public void no_pawnio_snapshot_serialises_explicit_nulls_without_driver()
    {
        var snapshot = new CpuReadSnapshot
        {
            Name = "Intel Core i7-3770K",
            Cores = new List<CpuCoreSnapshot>
            {
                new CpuCoreSnapshot { Index = 0 },
                new CpuCoreSnapshot { Index = 1 },
                new CpuCoreSnapshot { Index = 2 },
                new CpuCoreSnapshot { Index = 3 },
            },
        };

        var json = ProtocolJson.SerializeSuccess(snapshot);
        using var doc = JsonDocument.Parse(json);
        var cpu = doc.RootElement.GetProperty("cpu");
        Assert.Equal(JsonValueKind.Null, cpu.GetProperty("packageTempC").ValueKind);
        Assert.Equal(JsonValueKind.Null, cpu.GetProperty("packagePowerW").ValueKind);
        Assert.False(cpu.TryGetProperty("driver", out _));
        var core0 = cpu.GetProperty("cores")[0];
        Assert.Equal(JsonValueKind.Null, core0.GetProperty("tempC").ValueKind);
        Assert.Equal(JsonValueKind.Null, core0.GetProperty("clockMHz").ValueKind);
    }
}