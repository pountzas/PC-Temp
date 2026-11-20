using System;
using System.Text.Json;

namespace LhmReader;

internal static class Program
{
    private static int Main()
    {
        try
        {
            using var probe = new LhmCpuProbe();
            probe.Open();

            while (true)
            {
                var line = Console.In.ReadLine();
                if (line is null)
                {
                    return 0;
                }

                if (string.IsNullOrWhiteSpace(line))
                {
                    continue;
                }

                JsonDocument doc;
                try
                {
                    doc = JsonDocument.Parse(line);
                }
                catch (JsonException)
                {
                    WriteStdout(ProtocolJson.SerializeError("invalid json"));
                    continue;
                }

                using (doc)
                {
                    if (!doc.RootElement.TryGetProperty("cmd", out var cmdEl))
                    {
                        WriteStdout(ProtocolJson.SerializeError("missing cmd"));
                        continue;
                    }

                    var cmd = cmdEl.GetString();
                    switch (cmd)
                    {
                        case "read":
                            HandleRead(probe);
                            break;
                        case "quit":
                            return 0;
                        default:
                            WriteStdout(ProtocolJson.SerializeError($"unknown cmd: {cmd}"));
                            break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 1;
        }
    }

    private static void HandleRead(LhmCpuProbe probe)
    {
        var snapshot = probe.ReadSnapshot();
        if (snapshot is null)
        {
            WriteStdout(ProtocolJson.SerializeError("no cpu hardware"));
            return;
        }

        WriteStdout(ProtocolJson.SerializeSuccess(snapshot));
    }

    private static void WriteStdout(string json)
    {
        Console.Out.WriteLine(json);
        Console.Out.Flush();
    }
}