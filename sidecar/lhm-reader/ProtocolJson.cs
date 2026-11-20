using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LhmReader;

public static class ProtocolJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public static string SerializeSuccess(CpuReadSnapshot cpu)
    {
        var payload = new SuccessResponse { Ok = true, Cpu = CpuDto.From(cpu) };
        return JsonSerializer.Serialize(payload, Options);
    }

    public static string SerializeError(string message)
    {
        var payload = new ErrorResponse { Ok = false, Error = message };
        return JsonSerializer.Serialize(payload, Options);
    }

    private sealed class SuccessResponse
    {
        public bool Ok { get; set; }
        public CpuDto? Cpu { get; set; }
    }

    private sealed class ErrorResponse
    {
        public bool Ok { get; set; }
        public string? Error { get; set; }
    }

    public sealed class CpuDto
    {
        public string Name { get; set; } = string.Empty;
        public double? PackageTempC { get; set; }
        public double? PackagePowerW { get; set; }
        public IList<CoreDto> Cores { get; set; } = new List<CoreDto>();

        public static CpuDto From(CpuReadSnapshot snapshot) =>
            new()
            {
                Name = snapshot.Name,
                PackageTempC = snapshot.PackageTempC,
                PackagePowerW = snapshot.PackagePowerW,
                Cores = snapshot.Cores
                    .Select(
                        c =>
                            new CoreDto
                            {
                                Index = c.Index,
                                TempC = c.TempC,
                                ClockMHz = c.ClockMHz,
                            })
                    .ToList(),
            };
    }

    public sealed class CoreDto
    {
        public byte Index { get; set; }
        public double? TempC { get; set; }
        public double? ClockMHz { get; set; }
    }
}