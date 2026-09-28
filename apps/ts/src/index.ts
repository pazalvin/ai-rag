import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { waitForOllama } from "./llm/ollama.js";
import { ingestGuidelines } from "./rag/ingest.js";

async function start() {
  console.log("Waiting for Postgres...");
  await migrate();

  console.log("Waiting for Ollama...");
  await waitForOllama();
  console.log("Ollama is ready.");

  console.log("Ingesting guidelines...");
  const count = await ingestGuidelines();
  console.log(`Indexed ${count} chunks.`);

  const app = createApp();

  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log(
        `Loan eligibility API listening on http://localhost:${info.port}`
      );
    }
  );
}

start().catch((err) => {
  console.error("Failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
