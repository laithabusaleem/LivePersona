import fs from "node:fs";
import path from "node:path";

export function loadEnvFile(): void {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", "..", ".env"),
    path.join(process.cwd(), "..", ".env"),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
