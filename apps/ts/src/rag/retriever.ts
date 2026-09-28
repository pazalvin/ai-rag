import { config } from "../config.js";
import { sqlClient } from "../db/client.js";
import type { MatchedChunk } from "../db/schema.js";
import type { LoanApplicationInput } from "../schemas/loan.js";
import { embedText } from "./embedder.js";

/**
 * Build a short retrieval query from loan application fields.
 */
export function buildQuery(application: LoanApplicationInput): string {
  return [
    `loan eligibility age ${application.age}`,
    `monthly income ${application.monthlyIncome}`,
    `employment ${application.employmentStatus}`,
    `work tenure ${application.monthsEmployed} months`,
    `loan amount ${application.loanAmount}`,
    `term ${application.loanTermMonths} months`,
    `credit score ${application.creditScore}`,
    `existing debt ${application.existingDebt}`,
    "minimum salary income capacity employment tenure debt to income installment affordability",
  ].join(" ");
}

/**
 * Embed the application query and return top-k chunks by pgvector cosine distance.
 * score = 1 - cosine_distance (higher is more similar).
 */
export async function retrieveRelevantChunks(
  application: LoanApplicationInput,
  k = config.topK
): Promise<MatchedChunk[]> {
  const query = buildQuery(application);
  const embedding = await embedText(query);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const rows = await sqlClient`
    SELECT
      id,
      source,
      content AS text,
      (1 - (embedding <=> ${vectorLiteral}::vector))::float8 AS score
    FROM guideline_chunks
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${k}
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    source: String(row.source),
    text: String(row.text),
    score: Number(row.score),
  }));
}

export async function countChunks(): Promise<number> {
  const [row] = await sqlClient`
    SELECT count(*)::int AS count FROM guideline_chunks
  `;
  return Number(row?.count ?? 0);
}
