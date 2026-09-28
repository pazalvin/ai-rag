import { config } from "../config.js";
import type { MatchedChunk } from "../db/schema.js";
import type { LoanApplicationInput } from "../schemas/loan.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatResponse = {
  message?: { content?: string };
};

export type EligibilityJudgment = {
  eligible: boolean;
  reasons: string[];
  matched_rules: string[];
  raw: string;
};

/**
 * Poll Ollama until /api/tags responds successfully.
 */
export async function waitForOllama(
  retries = 60,
  delayMs = 2000
): Promise<void> {
  let lastError: unknown;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${config.ollamaBaseUrl}/api/tags`);
      if (res.ok) return;
      lastError = new Error(`Ollama returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(delayMs);
  }

  throw new Error(
    `Ollama not reachable at ${config.ollamaBaseUrl}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

/**
 * Short one-shot chat completion via Ollama /api/chat.
 */
export async function chat(
  messages: ChatMessage[],
  temperature = 0.1
): Promise<string> {
  const res = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.llmModel,
      messages,
      stream: false,
      options: {
        temperature,
        num_predict: 256,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM chat failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as ChatResponse;
  return data.message?.content?.trim() || "";
}

/**
 * Ask the LLM to judge eligibility using only retrieved guideline context.
 */
export async function judgeEligibility(
  application: LoanApplicationInput,
  chunks: MatchedChunk[]
): Promise<EligibilityJudgment> {
  const context = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n");

  const customer = {
    age: application.age,
    monthlyIncome: application.monthlyIncome,
    employmentStatus: application.employmentStatus,
    monthsEmployed: application.monthsEmployed,
    loanAmount: application.loanAmount,
    loanTermMonths: application.loanTermMonths,
    creditScore: application.creditScore,
    existingDebt: application.existingDebt,
  };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        'You are a loan eligibility checker. Use ONLY the given guidelines. Reply with JSON only: {"eligible":boolean,"reasons":string[],"matched_rules":string[]}. No extra text.',
    },
    {
      role: "user",
      content: `Guidelines:\n${context}\n\nApplicant:\n${JSON.stringify(customer)}\n\nJSON:`,
    },
  ];

  const raw = await chat(messages);
  return parseJudgment(raw);
}

export function parseJudgment(raw: string): EligibilityJudgment {
  const fallback: EligibilityJudgment = {
    eligible: false,
    reasons: ["Could not parse model response"],
    matched_rules: [],
    raw,
  };

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;

    const parsed = JSON.parse(match[0]) as {
      eligible?: unknown;
      reasons?: unknown;
      matched_rules?: unknown;
    };

    return {
      eligible: Boolean(parsed.eligible),
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.map(String)
        : [],
      matched_rules: Array.isArray(parsed.matched_rules)
        ? parsed.matched_rules.map(String)
        : [],
      raw,
    };
  } catch {
    return fallback;
  }
}
