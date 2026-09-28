import type { LoanApplicationInput } from "../schemas/loan.js";
import { classifyProofDocument } from "./classifyProofDocument.js";
import {
  extractProofSignals,
  type ExtractedProofSignals,
} from "./extractProofSignals.js";
import { loadLoanRules } from "./loadRules.js";
import type {
  DocumentVerificationConfig,
  LoanRules,
  ProofDocumentType,
} from "./rulesSchema.js";

export type ProofDocumentInput = {
  fileName: string;
  text: string;
};

export type ProofDocumentAssessment = {
  fileName: string;
  type: ProofDocumentType;
  confidence: number;
  relatedToLoanCapacity: boolean;
  matchedKeywords: string[];
  signals: ExtractedProofSignals;
  issues: string[];
  accepted: boolean;
};

export type DocumentVerificationResult = {
  passed: boolean;
  required: boolean;
  summary: string[];
  documents: ProofDocumentAssessment[];
  config: DocumentVerificationConfig;
};

function namesRoughlyMatch(claimed: string, extracted?: string): boolean {
  if (!extracted) return false;
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = normalize(claimed);
  const b = normalize(extracted);
  if (!a || !b) return false;
  if (a === b) return true;
  const aParts = a.split(" ").filter((p) => p.length > 1);
  const bParts = new Set(b.split(" ").filter((p) => p.length > 1));
  const overlap = aParts.filter((p) => bParts.has(p)).length;
  return overlap >= Math.min(2, aParts.length);
}

function incomeWithinTolerance(
  claimed: number,
  evidence: number,
  tolerancePercent: number
): boolean {
  if (claimed <= 0) return false;
  const delta = Math.abs(claimed - evidence) / claimed;
  return delta <= tolerancePercent / 100;
}

/**
 * Verify proof documents (payslip, bank statement, COE) against the application.
 * Checks: document is capacity-related, type accepted, name/income consistency.
 */
export function verifyProofDocuments(
  application: LoanApplicationInput,
  proofs: ProofDocumentInput[],
  rules: LoanRules = loadLoanRules()
): DocumentVerificationResult {
  const cfg = rules.documentVerification;
  const summary: string[] = [];
  const documents: ProofDocumentAssessment[] = [];

  if (!cfg.required) {
    return {
      passed: true,
      required: false,
      summary: ["Proof document verification is disabled in rules."],
      documents: [],
      config: cfg,
    };
  }

  if (proofs.length < cfg.minProofDocuments) {
    summary.push(
      `At least ${cfg.minProofDocuments} proof document(s) required (payslip, bank statement, or employment certificate). Received ${proofs.length}.`
    );
  }

  let hasAcceptedIncomeProof = false;

  for (const proof of proofs) {
    const classification = classifyProofDocument(proof.text);
    const signals = extractProofSignals(proof.text, classification.type);
    const issues: string[] = [];

    if (!classification.relatedToLoanCapacity || classification.type === "unknown") {
      issues.push(
        "Document does not look like a payslip, bank statement, or employment certificate related to loan capacity."
      );
    }

    if (
      cfg.rejectUnknownTypes &&
      !cfg.acceptedTypes.includes(classification.type)
    ) {
      issues.push(
        `Document type "${classification.type}" is not in accepted proof types.`
      );
    }

    if (cfg.requireNameMatch) {
      if (!signals.employeeOrAccountName) {
        issues.push("Could not find an employee/account name on the document.");
      } else if (
        !namesRoughlyMatch(application.fullName, signals.employeeOrAccountName)
      ) {
        issues.push(
          `Name on document ("${signals.employeeOrAccountName}") does not match applicant ("${application.fullName}").`
        );
      }
    }

    if (
      classification.type === "payslip" ||
      classification.type === "bank_statement"
    ) {
      if (signals.monthlyIncomeEvidence == null) {
        issues.push("Could not extract income / salary evidence from document.");
      } else if (
        !incomeWithinTolerance(
          application.monthlyIncome,
          signals.monthlyIncomeEvidence,
          cfg.incomeMatchTolerancePercent
        )
      ) {
        issues.push(
          `Income on document (${signals.monthlyIncomeEvidence}) is outside ${cfg.incomeMatchTolerancePercent}% of claimed monthly income (${application.monthlyIncome}).`
        );
      } else {
        hasAcceptedIncomeProof = true;
      }
    }

    if (
      classification.type === "employment_certificate" &&
      issues.length === 0
    ) {
      // COE can support employment; income still preferred from payslip/bank
      hasAcceptedIncomeProof = hasAcceptedIncomeProof || proofs.length === 1;
    }

    const accepted =
      issues.length === 0 && classification.relatedToLoanCapacity;

    documents.push({
      fileName: proof.fileName,
      type: classification.type,
      confidence: classification.confidence,
      relatedToLoanCapacity: classification.relatedToLoanCapacity,
      matchedKeywords: classification.matchedKeywords,
      signals,
      issues,
      accepted,
    });
  }

  const acceptedCount = documents.filter((d) => d.accepted).length;
  if (proofs.length > 0 && acceptedCount === 0) {
    summary.push("No uploaded proof documents passed verification.");
  }

  const needsIncomeDoc = documents.some(
    (d) => d.type === "payslip" || d.type === "bank_statement"
  );
  if (
    proofs.length >= cfg.minProofDocuments &&
    needsIncomeDoc &&
    !hasAcceptedIncomeProof &&
    documents.every((d) => d.type !== "employment_certificate" || !d.accepted)
  ) {
    summary.push(
      "No accepted payslip/bank statement income evidence matched the claimed monthly income."
    );
  }

  // Prefer at least one fully accepted document when proofs were provided
  if (
    proofs.length >= cfg.minProofDocuments &&
    acceptedCount > 0 &&
    (hasAcceptedIncomeProof ||
      documents.some((d) => d.accepted && d.type === "employment_certificate"))
  ) {
    // clear income-only failure noise if we already have accepted docs with income
    const idx = summary.findIndex((s) =>
      s.includes("No accepted payslip/bank statement")
    );
    if (hasAcceptedIncomeProof && idx >= 0) summary.splice(idx, 1);
  }

  if (acceptedCount > 0 && hasAcceptedIncomeProof) {
    summary.push(
      `${acceptedCount} proof document(s) verified as related to repayment capacity.`
    );
  }

  const passed =
    proofs.length >= cfg.minProofDocuments &&
    acceptedCount >= cfg.minProofDocuments &&
    hasAcceptedIncomeProof;

  if (passed && summary.length === 0) {
    summary.push("Proof documents verified successfully.");
  }

  return {
    passed,
    required: true,
    summary,
    documents,
    config: cfg,
  };
}
