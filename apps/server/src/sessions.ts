import fs from "node:fs";
import path from "node:path";

export type SessionEntry = {
  id: string;
  createdAt: string;
  messages: Array<{ role: string; content: string; createdAt: number }>;
};

export class SessionStore {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = path.join(baseDir, "sessions");
    fs.mkdirSync(this.dir, { recursive: true });
  }

  list(): SessionEntry[] {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): SessionEntry | null {
    const file = path.join(this.dir, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  save(entry: SessionEntry): void {
    fs.writeFileSync(
      path.join(this.dir, `${entry.id}.json`),
      JSON.stringify(entry, null, 2),
      "utf8",
    );
  }

  delete(id: string): boolean {
    const file = path.join(this.dir, `${id}.json`);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }

  clear(): void {
    for (const f of fs.readdirSync(this.dir)) {
      if (f.endsWith(".json")) fs.unlinkSync(path.join(this.dir, f));
    }
  }
}
