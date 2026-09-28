import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..", "..", "..");

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: requireEnv(
    "DATABASE_URL",
    "postgres://loan:loan@localhost:5432/loan_rag"
  ),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  llmModel: process.env.LLM_MODEL || "llama3.2:1b",
  embedModel: process.env.EMBED_MODEL || "nomic-embed-text",
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS) || 768,
  topK: Number(process.env.TOP_K) || 3,
  chunkSize: Number(process.env.CHUNK_SIZE) || 400,
  chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 50,
  guidelinesDir: path.join(rootDir, "data", "guidelines"),
  loanRulesPath: (() => {
    const fromEnv = process.env.LOAN_RULES_PATH;
    if (!fromEnv) {
      return path.join(rootDir, "data", "rules", "loan-rules.json");
    }
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(rootDir, fromEnv);
  })(),
} as const;
