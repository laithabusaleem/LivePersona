export type AppConfig = {
  port: number;
  host: string;
  corsOrigin: string;
  modelProvider: "demo" | "openai";
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  sessionLogging: boolean;
  requestTimeoutMs: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 8790),
    host: env.HOST ?? "127.0.0.1",
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:5174",
    modelProvider: env.MODEL_PROVIDER === "openai" ? "openai" : "demo",
    openaiBaseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiApiKey: env.OPENAI_API_KEY ?? "",
    openaiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    sessionLogging: env.SESSION_LOGGING === "true",
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 60000),
  };
}

export function llmConfigured(config: AppConfig): boolean {
  return config.modelProvider === "openai" && Boolean(config.openaiApiKey);
}
