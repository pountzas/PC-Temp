using System;
using System.IO;
using System.Text.Json;

namespace LhmReader;

public static class ProtocolLoop
{
    public static int Run(TextReader input, TextWriter output, TextWriter errorLog, Func<CpuReadSnapshot?> readCpu)
    {
        try
        {
            while (true)
            {
                var line = input.ReadLine();
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
                    WriteLine(output, ProtocolJson.SerializeError("invalid json"));
                    continue;
                }

                using (doc)
                {
                    if (doc.RootElement.ValueKind != JsonValueKind.Object)
                    {
                        WriteLine(output, ProtocolJson.SerializeError("missing cmd"));
                        continue;
                    }

                    if (!doc.RootElement.TryGetProperty("cmd", out var cmdEl)
                        || cmdEl.ValueKind != JsonValueKind.String)
                    {
                        WriteLine(output, ProtocolJson.SerializeError("missing cmd"));
                        continue;
                    }

                    var cmd = cmdEl.GetString();
                    switch (cmd)
                    {
                        case "read":
                            HandleRead(output, errorLog, readCpu);
                            break;
                        case "quit":
                            return 0;
                        default:
                            WriteLine(output, ProtocolJson.SerializeError($"unknown cmd: {cmd}"));
                            break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            errorLog.WriteLine(ex);
            return 1;
        }
    }

    private static void HandleRead(
        TextWriter output,
        TextWriter errorLog,
        Func<CpuReadSnapshot?> readCpu)
    {
        try
        {
            var snapshot = readCpu();
            if (snapshot is null)
            {
                WriteLine(output, ProtocolJson.SerializeError("no cpu hardware"));
                return;
            }

            WriteLine(output, ProtocolJson.SerializeSuccess(snapshot));
        }
        catch (Exception ex)
        {
            errorLog.WriteLine(ex);
            WriteLine(output, ProtocolJson.SerializeError("read failed: " + ex.Message));
        }
    }

    private static void WriteLine(TextWriter output, string json)
    {
        output.WriteLine(json);
        output.Flush();
    }
}