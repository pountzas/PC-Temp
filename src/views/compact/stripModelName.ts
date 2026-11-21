const VENDOR_PREFIXES = [
  /^Intel(?:\s*\(R\))?\s+Core(?:\s*\(TM\))?\s+/i,
  /^AMD\s+/i,
  /^NVIDIA\s+GeForce\s+/i,
] as const;

export function stripModelName(fullName: string): string {
  let name = fullName;
  for (const pattern of VENDOR_PREFIXES) {
    name = name.replace(pattern, "");
  }
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fullName;
}
