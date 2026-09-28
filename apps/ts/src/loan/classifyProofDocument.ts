import type { ProofDocumentType } from "./rulesSchema.js";

type KeywordSet = { type: ProofDocumentType; keywords: string[]; weight: number };

const CLASSIFIERS: KeywordSet[] = [
  {
    type: "payslip",
    weight: 1,
    keywords: [
      "payslip",
      "pay slip",
      "salary slip",
      "net pay",
      "gross pay",
      "basic salary",
      "payroll",
      "pay period",
      "employer",
      "ytd earnings",
    ],
  },
  {
    type: "bank_statement",
    weight: 1,
    keywords: [
      "bank statement",
      "account statement",
      "account number",
      "opening balance",
      "closing balance",
      "salary credit",
      "deposit",
      "withdrawal",
      "transaction history",
      "available balance",
    ],
  },
  {
    type: "employment_certificate",
    weight: 1,
    keywords: [
      "certificate of employment",
      "employment certificate",
      "currently employed",
      "position",
      "date hired",
      "this is to certify",
      "human resources",
      "tenure",
    ],
  },
];

export type ClassificationResult = {
  type: ProofDocumentType;
  confidence: number;
  matchedKeywords: string[];
  relatedToLoanCapacity: boolean;
};

/**
 * Classify a proof document from its extracted text (keyword scoring).
 * Documents that look like payslips / bank statements / COE are treated as
 * related to loan repayment capacity.
 */
export function classifyProofDocument(text: string): ClassificationResult {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const scores: Record<ProofDocumentType, { score: number; hits: string[] }> = {
    payslip: { score: 0, hits: [] },
    bank_statement: { score: 0, hits: [] },
    employment_certificate: { score: 0, hits: [] },
    unknown: { score: 0, hits: [] },
  };

  for (const set of CLASSIFIERS) {
    for (const keyword of set.keywords) {
      if (normalized.includes(keyword)) {
        scores[set.type].score += set.weight;
        scores[set.type].hits.push(keyword);
      }
    }
  }

  let best: ProofDocumentType = "unknown";
  let bestScore = 0;
  for (const type of [
    "payslip",
    "bank_statement",
    "employment_certificate",
  ] as const) {
    if (scores[type].score > bestScore) {
      bestScore = scores[type].score;
      best = type;
    }
  }

  // Need at least 2 keyword hits to avoid weak false positives
  if (bestScore < 2) {
    return {
      type: "unknown",
      confidence: 0,
      matchedKeywords: [],
      relatedToLoanCapacity: false,
    };
  }

  const confidence = Math.min(1, bestScore / 5);
  return {
    type: best,
    confidence,
    matchedKeywords: scores[best].hits,
    relatedToLoanCapacity: true,
  };
}
