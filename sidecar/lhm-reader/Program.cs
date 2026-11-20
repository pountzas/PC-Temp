using System;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using LibreHardwareMonitor.Hardware;

namespace LhmReader;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (args.Any(a => string.Equals(a, "--dump-sensors", StringComparison.OrdinalIgnoreCase)))
        {
            return RunSensorDump();
        }

        using var probe = new LhmCpuProbe();
        probe.Open();
        return ProtocolLoop.Run(
            Console.In,
            Console.Out,
            Console.Error,
            () => probe.ReadSnapshot());
    }

    // Dev-only: elevated run with PawnIO; writes fixture JSON to stdout.
    private static int RunSensorDump()
    {
        try
        {
            using var probe = new LhmCpuProbe();
            probe.Open();
            probe.AcceptForDump(out var cpuName, out var sensors);
            var payload = new
            {
                cpuName,
                sensors = sensors.Select(
                    s =>
                        new
                        {
                            type = s.Type,
                            name = s.Name,
                            value = s.Value,
                        }),
            };
            var json = JsonSerializer.Serialize(
                payload,
                new JsonSerializerOptions
                {
                    WriteIndented = true,
                    NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
                });
            Console.Out.WriteLine(json);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 1;
        }
    }
}