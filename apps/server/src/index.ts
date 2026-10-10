import path from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { loadEnvFile } from "./loadEnv.js";
import { SessionStore } from "./sessions.js";

loadEnvFile();
const config = loadConfig();
const dataDir = path.resolve(process.cwd(), "data");
const sessions = config.sessionLogging ? new SessionStore(dataDir) : null;
const app = createApp(config, sessions);

app.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      message: "LivePersona server listening",
      host: config.host,
      port: config.port,
      provider: config.modelProvider,
      sessionLogging: config.sessionLogging,
    }),
  );
});
