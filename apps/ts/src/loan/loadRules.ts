import fs from "node:fs";
import { config } from "../config.js";
import { loanRulesSchema, type LoanRules } from "./rulesSchema.js";

type Cache = {
  mtimeMs: number;
  rules: LoanRules;
};

let cache: Cache | null = null;

/**
 * Load underwriting rules from data/rules/loan-rules.json.
 * Reloads automatically when the file changes on disk.
 */
export function loadLoanRules(force = false): LoanRules {
  const filePath = config.loanRulesPath;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Loan rules file not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (!force && cache && cache.mtimeMs === stat.mtimeMs) {
    return cache.rules;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  const parsed = loanRulesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid loan rules config: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  cache = { mtimeMs: stat.mtimeMs, rules: parsed.data };
  return parsed.data;
}

export function reloadLoanRules(): LoanRules {
  cache = null;
  return loadLoanRules(true);
}

export function getCachedLoanRules(): LoanRules | null {
  return cache?.rules ?? null;
}
