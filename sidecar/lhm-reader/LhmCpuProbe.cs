using System;
using System.Collections.Generic;
using System.Threading;
using LibreHardwareMonitor.Hardware;

namespace LhmReader;

internal sealed class UpdateVisitor : IVisitor
{
    public void VisitComputer(IComputer computer) =>
        computer.Traverse(this);

    public void VisitHardware(IHardware hardware)
    {
        hardware.Update();
        foreach (var sub in hardware.SubHardware)
        {
            sub.Accept(this);
        }
    }

    public void VisitSensor(ISensor sensor) { }

    public void VisitParameter(IParameter parameter) { }
}

internal sealed class LhmCpuProbe : IDisposable
{
    private readonly Computer _computer = new() { IsCpuEnabled = true };
    private bool _open;

    public void Open()
    {
        if (_open)
        {
            return;
        }

        _computer.Open();
        _open = true;
    }

    public CpuReadSnapshot? ReadSnapshot()
    {
        if (!_open)
        {
            Open();
        }

        _computer.Accept(new UpdateVisitor());

        IHardware? cpu = null;
        foreach (var hardware in _computer.Hardware)
        {
            if (hardware.HardwareType == HardwareType.Cpu)
            {
                cpu = hardware;
                break;
            }
        }

        if (cpu is null)
        {
            return null;
        }

        var sensors = new List<SensorSnapshot>();
        foreach (var sensor in cpu.Sensors)
        {
            if (sensor.Value is null)
            {
                continue;
            }

            sensors.Add(
                new SensorSnapshot(
                    sensor.SensorType.ToString(),
                    sensor.Name,
                    sensor.Value));
        }

        return SensorMapper.Map(cpu.Name, sensors);
    }

    public void AcceptForDump(out string cpuName, out IReadOnlyList<SensorSnapshot> sensors)
    {
        if (!_open)
        {
            Open();
        }

        // Two updates ~1s apart so RAPL power and effective core clocks are populated in the dump.
        _computer.Accept(new UpdateVisitor());
        Thread.Sleep(1000);
        _computer.Accept(new UpdateVisitor());

        IHardware? cpu = null;
        foreach (var hardware in _computer.Hardware)
        {
            if (hardware.HardwareType == HardwareType.Cpu)
            {
                cpu = hardware;
                break;
            }
        }

        if (cpu is null)
        {
            throw new InvalidOperationException("no cpu hardware");
        }

        cpuName = cpu.Name;
        var list = new List<SensorSnapshot>();
        foreach (var sensor in cpu.Sensors)
        {
            list.Add(
                new SensorSnapshot(
                    sensor.SensorType.ToString(),
                    sensor.Name,
                    sensor.Value));
        }

        sensors = list;
    }

    public void Dispose()
    {
        if (_open)
        {
            _computer.Close();
            _open = false;
        }
    }
}