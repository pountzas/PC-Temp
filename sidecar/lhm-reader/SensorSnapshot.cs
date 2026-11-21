using System.Collections.Generic;

namespace LhmReader;

/// <summary>One LHM sensor reading used for mapping (unit-test seam).</summary>
public sealed class SensorSnapshot
{
    public SensorSnapshot(string type, string name, float? value)
    {
        Type = type;
        Name = name;
        Value = value;
    }

    public string Type { get; }
    public string Name { get; }
    public float? Value { get; }
}

public sealed class CpuCoreSnapshot
{
    public byte Index { get; set; }
    public double? TempC { get; set; }
    public double? ClockMHz { get; set; }
}

public sealed class CpuReadSnapshot
{
    public string Name { get; set; } = string.Empty;
    public double? PackageTempC { get; set; }
    public double? PackagePowerW { get; set; }
    public IList<CpuCoreSnapshot> Cores { get; set; } = new List<CpuCoreSnapshot>();
}