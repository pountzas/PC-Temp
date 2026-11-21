using System;
using System.IO;
using System.Text;
using System.Text.Json;
using Xunit;

namespace LhmReader.Tests;

public sealed class ProtocolLoopTests
{
    [Fact]
    public void quit_returns_zero()
    {
        var input = new StringReader("{\"cmd\":\"quit\"}\n");
        var output = new StringWriter();
        var exit = ProtocolLoop.Run(input, output, TextWriter.Null, () => null);
        Assert.Equal(0, exit);
    }

    [Fact]
    public void eof_returns_zero()
    {
        var input = new StringReader("");
        var output = new StringWriter();
        var exit = ProtocolLoop.Run(input, output, TextWriter.Null, () => null);
        Assert.Equal(0, exit);
    }

    [Fact]
    public void invalid_json_writes_error_and_continues()
    {
        var input = new StringReader("not-json\n{\"cmd\":\"quit\"}\n");
        var output = new StringWriter();
        var exit = ProtocolLoop.Run(input, output, TextWriter.Null, () => null);
        Assert.Equal(0, exit);
        Assert.Contains("\"ok\":false", output.ToString());
    }

    [Fact]
    public void numeric_cmd_writes_missing_cmd_and_continues()
    {
        var input = new StringReader("{\"cmd\":1}\n{\"cmd\":\"quit\"}\n");
        var output = new StringWriter();
        var exit = ProtocolLoop.Run(input, output, TextWriter.Null, () => null);
        Assert.Equal(0, exit);
        Assert.Contains("missing cmd", output.ToString());
    }

    [Fact]
    public void array_root_writes_missing_cmd_and_continues()
    {
        var input = new StringReader("[]\n{\"cmd\":\"quit\"}\n");
        var output = new StringWriter();
        var exit = ProtocolLoop.Run(input, output, TextWriter.Null, () => null);
        Assert.Equal(0, exit);
        Assert.Contains("missing cmd", output.ToString());
    }

    [Fact]
    public void unknown_cmd_writes_error_and_continues()
    {
        var input = new StringReader("{\"cmd\":\"nope\"}\n{\"cmd\":\"quit\"}\n");
        var output = new StringWriter();
        var exit = ProtocolLoop.Run(input, output, TextWriter.Null, () => null);
        Assert.Equal(0, exit);
        Assert.Contains("unknown cmd", output.ToString());
    }

    [Fact]
    public void throwing_read_writes_read_failed_and_continues()
    {
        var input = new StringReader("{\"cmd\":\"read\"}\n{\"cmd\":\"quit\"}\n");
        var output = new StringWriter();
        var exit = ProtocolLoop.Run(
            input,
            output,
            TextWriter.Null,
            () => throw new InvalidOperationException("boom"));
        Assert.Equal(0, exit);
        Assert.Contains("read failed", output.ToString());
    }

    [Fact]
    public void successful_read_writes_ok_true_line()
    {
        var input = new StringReader("{\"cmd\":\"read\"}\n{\"cmd\":\"quit\"}\n");
        var output = new StringWriter();
        var snapshot = new CpuReadSnapshot
        {
            Name = "Test CPU",
            PackageTempC = 1,
            Cores =
            [
                new CpuCoreSnapshot { Index = 0, TempC = 1, ClockMHz = 100 },
            ],
        };
        var exit = ProtocolLoop.Run(input, output, TextWriter.Null, () => snapshot);
        Assert.Equal(0, exit);
        using var doc = JsonDocument.Parse(output.ToString().Split('\n')[0]);
        Assert.True(doc.RootElement.GetProperty("ok").GetBoolean());
    }
}