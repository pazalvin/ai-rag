import { pathToFileURL } from "node:url";
import { sqlClient } from "./client.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ensure pgvector + tables exist. Safe to run on every boot.
 */
export async function migrate(retries = 30, delayMs = 2000): Promise<void> {
  let lastError: unknown;

  for (let i = 0; i < retries; i++) {
    try {
      await sqlClient`CREATE EXTENSION IF NOT EXISTS vector`;

      await sqlClient`
        CREATE TABLE IF NOT EXISTS guideline_chunks (
          id SERIAL PRIMARY KEY,
          source TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding vector(768) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sqlClient`
        CREATE INDEX IF NOT EXISTS guideline_chunks_source_idx
        ON guideline_chunks (source)
      `;

      // HNSW index for cosine distance (pgvector)
      await sqlClient`
        CREATE INDEX IF NOT EXISTS guideline_chunks_embedding_hnsw_idx
        ON guideline_chunks
        USING hnsw (embedding vector_cosine_ops)
      `;

      await sqlClient`
        CREATE TABLE IF NOT EXISTS loan_applications (
          id SERIAL PRIMARY KEY,
          full_name TEXT NOT NULL,
          age INTEGER NOT NULL,
          monthly_income INTEGER NOT NULL,
          employment_status TEXT NOT NULL,
          months_employed INTEGER NOT NULL DEFAULT 0,
          loan_amount INTEGER NOT NULL,
          loan_term_months INTEGER NOT NULL,
          credit_score INTEGER NOT NULL,
          existing_debt INTEGER NOT NULL,
          eligible BOOLEAN,
          reasons JSONB,
          matched_rules JSONB,
          matched_chunk_ids JSONB,
          similarity_scores JSONB,
          raw_llm TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sqlClient`
        ALTER TABLE loan_applications
        ADD COLUMN IF NOT EXISTS months_employed INTEGER NOT NULL DEFAULT 0
      `;

      console.log("Database migrations applied.");
      return;
    } catch (err) {
      lastError = err;
      console.warn(
        `Waiting for Postgres... (${i + 1}/${retries})`,
        err instanceof Error ? err.message : err
      );
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Database migration failed: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
