using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace LhmReader;

/// <summary>Maps LHM sensor snapshots into the host IPC cpu shape (HW-04).</summary>
public static class SensorMapper
{
    public const int DefaultCoreCount = 4;

    private static readonly Regex CoreSensorName = new(
        @"^CPU Core #(\d+)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static CpuReadSnapshot Map(
        string cpuName,
        IReadOnlyList<SensorSnapshot> sensors,
        int coreCount = DefaultCoreCount)
    {
        var cores = new CpuCoreSnapshot[coreCount];
        for (var i = 0; i < coreCount; i++)
        {
            cores[i] = new CpuCoreSnapshot { Index = (byte)i };
        }

        double? packageTempC = null;
        double? packagePowerW = null;

        foreach (var sensor in sensors)
        {
            if (string.IsNullOrEmpty(sensor.Name) || sensor.Value is null)
            {
                continue;
            }

            var value = (double)sensor.Value.Value;
            if (value == 0 || double.IsNaN(value) || double.IsInfinity(value))
            {
                continue;
            }

            if (sensor.Type == "Temperature" && sensor.Name == "CPU Package")
            {
                packageTempC = value;
                continue;
            }

            if (sensor.Type == "Power" && sensor.Name == "CPU Package")
            {
                packagePowerW = value;
                continue;
            }

            if (sensor.Type == "Temperature")
            {
                var match = CoreSensorName.Match(sensor.Name);
                if (match.Success && int.TryParse(match.Groups[1].Value, out var oneBased))
                {
                    var idx = oneBased - 1;
                    if (idx >= 0 && idx < coreCount)
                    {
                        cores[idx] = new CpuCoreSnapshot
                        {
                            Index = (byte)idx,
                            TempC = value,
                            ClockMHz = cores[idx].ClockMHz,
                        };
                    }
                }

                continue;
            }

            if (sensor.Type == "Clock")
            {
                var match = CoreSensorName.Match(sensor.Name);
                if (match.Success && int.TryParse(match.Groups[1].Value, out var oneBased))
                {
                    var idx = oneBased - 1;
                    if (idx >= 0 && idx < coreCount)
                    {
                        cores[idx] = new CpuCoreSnapshot
                        {
                            Index = (byte)idx,
                            TempC = cores[idx].TempC,
                            ClockMHz = value,
                        };
                    }
                }
            }
        }

        return new CpuReadSnapshot
        {
            Name = cpuName,
            PackageTempC = packageTempC,
            PackagePowerW = packagePowerW,
            Cores = cores,
        };
    }
}