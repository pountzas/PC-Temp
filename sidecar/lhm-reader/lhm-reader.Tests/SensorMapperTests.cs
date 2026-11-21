using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Xunit;

namespace LhmReader.Tests;

public sealed class SensorMapperTests
{
    [Fact]
    public void maps_i7_3770k_fixture_to_protocol_shape()
    {
        var (cpuName, sensors) = LoadFixture("i7-3770K.json");
        var snapshot = SensorMapper.Map(cpuName, sensors);

        Assert.Equal("Intel Core i7-3770K", snapshot.Name);
        Assert.Equal(62, snapshot.PackageTempC);
        Assert.InRange(snapshot.PackagePowerW!.Value, 37.25, 37.27);
        Assert.Equal(4, snapshot.Cores.Count);

        Assert.Equal(56.0, snapshot.Cores[0].TempC!.Value);
        Assert.InRange(snapshot.Cores[0].ClockMHz!.Value, 3710.9, 3711.0);
        Assert.Equal(60.0, snapshot.Cores[1].TempC!.Value);
        Assert.Equal(65.0, snapshot.Cores[2].TempC!.Value);
        Assert.Equal(62.0, snapshot.Cores[3].TempC!.Value);
        Assert.InRange(snapshot.Cores[2].ClockMHz!.Value, 3911.4, 3911.5);
        Assert.InRange(snapshot.Cores[3].ClockMHz!.Value, 3811.1, 3811.3);
    }

    [Fact]
    public void i7_recorded_dump_has_extra_sensors_mapper_still_maps_package()
    {
        var (_, sensors) = LoadFixture("i7-3770K.json");
        Assert.True(sensors.Count > 10);
        var snapshot = SensorMapper.Map("Intel Core i7-3770K", sensors);
        Assert.Equal(62, snapshot.PackageTempC);
        Assert.Contains(sensors, s => s.Type == "Load" && s.Name == "CPU Total");
        Assert.Contains(sensors, s => s.Type == "Temperature" && s.Name == "Core Max");
        Assert.Equal(62, snapshot.PackageTempC); // CPU Package, not Core Max (65)
    }

    [Fact]
    public void missing_sensors_use_null_not_zero()
    {
        var snapshot = SensorMapper.Map(
            "Intel Core i7-3770K",
            new List<SensorSnapshot> { new SensorSnapshot("Load", "CPU Total", 12) });

        Assert.Null(snapshot.PackageTempC);
        Assert.Null(snapshot.PackagePowerW);
        foreach (var core in snapshot.Cores)
        {
            Assert.Null(core.TempC);
            Assert.Null(core.ClockMHz);
            Assert.NotEqual(0, core.TempC);
            Assert.NotEqual(0, core.ClockMHz);
        }
    }

    [Fact]
    public void protocol_json_matches_recorded_rust_fixture()
    {
        var (cpuName, sensors) = LoadFixture("i7-3770K.json");
        var snapshot = SensorMapper.Map(cpuName, sensors);
        var json = ProtocolJson.SerializeSuccess(snapshot);
        var expected = File.ReadAllText(
            Path.Combine(AppContext.BaseDirectory, "fixtures", "lhm_read.json")).Trim();

        Assert.Equal(expected, json.Trim());

        using var doc = JsonDocument.Parse(json);
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
        var cpu = doc.RootElement.GetProperty("cpu");
        Assert.Equal(62, cpu.GetProperty("packageTempC").GetDouble());
        Assert.InRange(cpu.GetProperty("packagePowerW").GetDouble(), 37.25, 37.27);
        Assert.False(cpu.TryGetProperty("driver", out _));

        var cores = cpu.GetProperty("cores");
        Assert.Equal(4, cores.GetArrayLength());
        Assert.InRange(cores[0].GetProperty("clockMHz").GetDouble(), 3710.9, 3711.0);
    }

    [Fact]
    public void nan_package_power_maps_to_null()
    {
        var sensors = new List<SensorSnapshot>
        {
            new SensorSnapshot("Power", "CPU Package", float.NaN),
            new SensorSnapshot("Temperature", "CPU Package", 40),
        };

        var snapshot = SensorMapper.Map("Intel Core i7-3770K", sensors);
        Assert.Null(snapshot.PackagePowerW);
        Assert.Equal(40, snapshot.PackageTempC);
    }

    [Fact]
    public void absent_core_sensors_stay_null_not_zero()
    {
        var sensors = new List<SensorSnapshot>
        {
            new SensorSnapshot("Temperature", "CPU Package", 40),
            new SensorSnapshot("Power", "CPU Package", 30),
            new SensorSnapshot("Temperature", "CPU Core #1", 39),
            new SensorSnapshot("Clock", "CPU Core #1", 3500),
        };

        var snapshot = SensorMapper.Map("Intel Core i7-3770K", sensors);

        Assert.Null(snapshot.Cores[1].TempC);
        Assert.Null(snapshot.Cores[1].ClockMHz);
        Assert.Null(snapshot.Cores[3].ClockMHz);
        Assert.DoesNotContain(snapshot.Cores, c => c.TempC == 0);
        Assert.DoesNotContain(snapshot.Cores, c => c.ClockMHz == 0);
    }

    private static (string CpuName, List<SensorSnapshot> Sensors) LoadFixture(string fileName)
    {
        var path = Path.Combine(
            AppContext.BaseDirectory,
            "fixtures",
            fileName);
        var raw = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        var cpuName = root.GetProperty("cpuName").GetString()!;

        var sensors = new List<SensorSnapshot>();
        foreach (var item in root.GetProperty("sensors").EnumerateArray())
        {
            var type = item.GetProperty("type").GetString()!;
            var name = item.GetProperty("name").GetString()!;
            float? value = null;
            if (item.TryGetProperty("value", out var valueEl) && valueEl.ValueKind == JsonValueKind.Number)
            {
                value = (float)valueEl.GetDouble();
            }

            sensors.Add(new SensorSnapshot(type, name, value));
        }

        return (cpuName, sensors);
    }
}