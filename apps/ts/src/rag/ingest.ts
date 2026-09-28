import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { config } from "../config.js";
import { db, sqlClient } from "../db/client.js";
import { guidelineChunks } from "../db/schema.js";
import { chunkText } from "./chunker.js";
import { listGuidelineFiles, loadGuidelineText } from "./documents.js";
import { embedText } from "./embedder.js";

/**
 * Read guideline markdown/PDF files, chunk, embed, and store in Postgres (pgvector).
 */
export async function ingestGuidelines({
  force = false,
}: { force?: boolean } = {}): Promise<number> {
  if (!fs.existsSync(config.guidelinesDir)) {
    throw new Error(`Guidelines directory not found: ${config.guidelinesDir}`);
  }

  const files = listGuidelineFiles(config.guidelinesDir);

  if (files.length === 0) {
    throw new Error("No guideline files found (.md, .txt, or .pdf)");
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(guidelineChunks);

  if (!force && count > 0) {
    console.log(`Using existing vector index (${count} chunks).`);
    return count;
  }

  if (count > 0) {
    await sqlClient`TRUNCATE guideline_chunks RESTART IDENTITY`;
  }

  let inserted = 0;

  for (const file of files) {
    const fullPath = path.join(config.guidelinesDir, file);
    const text = await loadGuidelineText(fullPath);
    const chunks = chunkText(text, config.chunkSize, config.chunkOverlap);

    console.log(`Embedding ${chunks.length} chunks from ${file}...`);

    for (const chunk of chunks) {
      const embedding = await embedText(chunk);
      const vectorLiteral = `[${embedding.join(",")}]`;

      await sqlClient`
        INSERT INTO guideline_chunks (source, content, embedding)
        VALUES (
          ${file},
          ${chunk},
          ${vectorLiteral}::vector
        )
      `;
      inserted += 1;
    }
  }

  return inserted;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  ingestGuidelines({ force: true })
    .then((count) => {
      console.log(`Ingested ${count} chunks.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
