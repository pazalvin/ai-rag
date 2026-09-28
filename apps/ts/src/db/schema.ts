import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { config } from "../config.js";

/**
 * pgvector column — stored as vector(N), queried with cosine operators.
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${config.embeddingDimensions})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number);
    if (typeof value === "string") {
      return value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map(Number);
    }
    throw new Error("Unexpected vector driver value");
  },
});

export const guidelineChunks = pgTable(
  "guideline_chunks",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("guideline_chunks_source_idx").on(table.source)]
);

export const loanApplications = pgTable("loan_applications", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  age: integer("age").notNull(),
  monthlyIncome: integer("monthly_income").notNull(),
  employmentStatus: text("employment_status").notNull(),
  monthsEmployed: integer("months_employed").notNull().default(0),
  loanAmount: integer("loan_amount").notNull(),
  loanTermMonths: integer("loan_term_months").notNull(),
  creditScore: integer("credit_score").notNull(),
  existingDebt: integer("existing_debt").notNull(),
  eligible: boolean("eligible"),
  reasons: jsonb("reasons").$type<string[]>(),
  matchedRules: jsonb("matched_rules").$type<string[]>(),
  matchedChunkIds: jsonb("matched_chunk_ids").$type<number[]>(),
  similarityScores: jsonb("similarity_scores").$type<number[]>(),
  rawLlm: text("raw_llm"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type GuidelineChunk = typeof guidelineChunks.$inferSelect;
export type LoanApplication = typeof loanApplications.$inferSelect;
export type NewLoanApplication = typeof loanApplications.$inferInsert;

/** Matched chunk shape returned by cosine top-k retrieval. */
export type MatchedChunk = {
  id: number;
  source: string;
  text: string;
  score: number;
};
