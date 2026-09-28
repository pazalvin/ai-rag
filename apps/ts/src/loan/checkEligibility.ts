import { db } from "../db/client.js";
import { loanApplications } from "../db/schema.js";
import { judgeEligibility, type EligibilityJudgment } from "../llm/ollama.js";
import { retrieveRelevantChunks } from "../rag/retriever.js";
import type { LoanApplicationInput } from "../schemas/loan.js";
import { evaluateRules, type RuleCheckResult } from "./evaluateRules.js";
import {
  verifyProofDocuments,
  type DocumentVerificationResult,
  type ProofDocumentInput,
} from "./verifyProofDocuments.js";

export type EligibilityResponse = {
  applicationId?: number;
  fullName: string;
  /** Final decision: rules + proof-document verification (when required). */
  eligible: boolean;
  reasons: string[];
  matched_rules: string[];
  ruleCheck: RuleCheckResult;
  documentVerification?: DocumentVerificationResult;
  aiCheck?: EligibilityJudgment;
  matchedChunks: Array<{
    id: number;
    source: string;
    text: string;
    score: number;
  }>;
  raw?: string;
  source?: "form" | "pdf" | "documents";
  parsedApplication?: LoanApplicationInput;
  rulesVersion?: string;
};

export type CheckOptions = {
  useLlm?: boolean;
  persist?: boolean;
  source?: "form" | "pdf" | "documents";
  /** Supporting PDFs (payslip, bank statement, COE). */
  proofDocuments?: ProofDocumentInput[];
  /** When true (default if proofs provided or rules.require), run verification. */
  verifyDocuments?: boolean;
};

/**
 * Run rules + optional proof-document verification + optional RAG/LLM.
 */
export async function checkEligibility(
  application: LoanApplicationInput,
  options: CheckOptions = {}
): Promise<EligibilityResponse> {
  const useLlm = options.useLlm !== false;
  const persist = options.persist !== false;
  const proofs = options.proofDocuments ?? [];

  const ruleCheck = evaluateRules(application);

  let documentVerification: DocumentVerificationResult | undefined;
  const shouldVerify =
    options.verifyDocuments === true ||
    proofs.length > 0 ||
    options.source === "documents";

  if (shouldVerify) {
    documentVerification = verifyProofDocuments(application, proofs);
  }

  let matchedChunks: EligibilityResponse["matchedChunks"] = [];
  let aiCheck: EligibilityJudgment | undefined;

  if (useLlm) {
    const chunks = await retrieveRelevantChunks(application);
    matchedChunks = chunks.map((chunk) => ({
      id: chunk.id,
      source: chunk.source,
      text: chunk.text,
      score: Number(chunk.score.toFixed(4)),
    }));
    aiCheck = await judgeEligibility(application, chunks);
  }

  const docOk =
    !documentVerification ||
    !documentVerification.required ||
    documentVerification.passed;

  const eligible = ruleCheck.eligible && docOk;

  const reasons = [
    ...ruleCheck.reasons,
    ...(documentVerification && !documentVerification.passed
      ? documentVerification.summary
      : []),
    ...(documentVerification?.documents.flatMap((d) =>
      d.issues.map((issue) => `${d.fileName}: ${issue}`)
    ) ?? []),
  ];

  // Deduplicate while preserving order
  const uniqueReasons = [...new Set(reasons)];

  let applicationId: number | undefined;
  if (persist) {
    const [saved] = await db
      .insert(loanApplications)
      .values({
        fullName: application.fullName,
        age: application.age,
        monthlyIncome: application.monthlyIncome,
        employmentStatus: application.employmentStatus,
        monthsEmployed: application.monthsEmployed,
        loanAmount: application.loanAmount,
        loanTermMonths: application.loanTermMonths,
        creditScore: application.creditScore,
        existingDebt: application.existingDebt,
        eligible,
        reasons: uniqueReasons,
        matchedRules: ruleCheck.matched_rules,
        matchedChunkIds: matchedChunks.map((chunk) => chunk.id),
        similarityScores: matchedChunks.map((chunk) => chunk.score),
        rawLlm: aiCheck?.raw ?? null,
      })
      .returning({ id: loanApplications.id });
    applicationId = saved?.id;
  }

  return {
    applicationId,
    fullName: application.fullName,
    eligible,
    reasons: uniqueReasons,
    matched_rules: ruleCheck.matched_rules,
    ruleCheck,
    documentVerification,
    aiCheck,
    matchedChunks,
    raw: aiCheck?.raw,
    source: options.source,
    parsedApplication: application,
    rulesVersion: ruleCheck.rulesVersion,
  };
}
