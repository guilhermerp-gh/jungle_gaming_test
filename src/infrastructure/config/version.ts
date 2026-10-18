import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function loadPackageVersion(): string {
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(currentDir, "../../../package.json");
    const raw = readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
      return parsed.version.trim();
    }
  } catch {
    try {
      const fallbackPath = resolve(process.cwd(), "package.json");
      const raw = readFileSync(fallbackPath, "utf-8");
      const parsed = JSON.parse(raw) as { version?: unknown };
      if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
        return parsed.version.trim();
      }
    } catch {
      // fallback gracioso em caso de isolamento de filesystem
    }
  }
  return "0.0.0";
}

export const APP_VERSION = loadPackageVersion();
