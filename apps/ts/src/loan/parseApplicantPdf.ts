import { extractText, getDocumentProxy } from "unpdf";
import {
  loanApplicationSchema,
  type LoanApplicationInput,
} from "../schemas/loan.js";

const FIELD_LABELS = [
  "Full Name",
  "Applicant Name",
  "Name",
  "Age",
  "Monthly Income",
  "Income",
  "Salary",
  "Employment Status",
  "Employment",
  "Work Status",
  "Months Employed",
  "Months at Current Work",
  "Work Tenure Months",
  "Tenure Months",
  "Loan Amount",
  "Requested Loan",
  "Loan Term Months",
  "Loan Term",
  "Term Months",
  "Credit Score",
  "Existing Debt",
  "Current Debt",
] as const;

function nextLabelPattern(): string {
  // Longest labels first so "Loan Term Months" wins over "Term"
  const sorted = [...FIELD_LABELS].sort((a, b) => b.length - a.length);
  return sorted.map((l) => l.replace(/\s+/g, "\\s+")).join("|");
}

function pickValue(text: string, labels: string[]): string | undefined {
  const stop = nextLabelPattern();
  for (const label of labels) {
    const labelRe = label.replace(/\s+/g, "\\s+");
    const re = new RegExp(
      `${labelRe}\\s*[:\\-]?\\s*(.+?)(?=(?:\\s+(?:${stop})\\s*[:\\-])|$)`,
      "i"
    );
    const match = text.match(re);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }
  return undefined;
}

function pickNumber(text: string, labels: string[]): number | undefined {
  const value = pickValue(text, labels);
  if (!value) return undefined;
  const num = value.match(/[0-9][0-9,]*/);
  if (!num) return undefined;
  return Number(num[0].replace(/,/g, ""));
}

/**
 * Parse a loan application PDF into structured fields.
 * Expects labeled values such as "Monthly Income: 45000".
 */
export function parseApplicantText(text: string): LoanApplicationInput {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

  const raw = {
    fullName: pickValue(normalized, ["Full Name", "Applicant Name", "Name"]),
    age: pickNumber(normalized, ["Age"]),
    monthlyIncome: pickNumber(normalized, [
      "Monthly Income",
      "Income",
      "Salary",
    ]),
    employmentStatus: pickValue(normalized, [
      "Employment Status",
      "Employment",
      "Work Status",
    ]),
    monthsEmployed: pickNumber(normalized, [
      "Months Employed",
      "Months at Current Work",
      "Work Tenure Months",
      "Tenure Months",
    ]),
    loanAmount: pickNumber(normalized, ["Loan Amount", "Requested Loan"]),
    loanTermMonths: pickNumber(normalized, [
      "Loan Term Months",
      "Loan Term",
      "Term Months",
    ]),
    creditScore: pickNumber(normalized, ["Credit Score"]),
    existingDebt: pickNumber(normalized, [
      "Existing Debt",
      "Current Debt",
    ]),
  };

  const parsed = loanApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    const looksLikeProof =
      /\b(payslip|pay\s*slip|payroll|bank\s*statement|certificate\s+of\s+employment|employee\s+name)\b/i.test(
        normalized
      );
    const hint = looksLikeProof
      ? " This file looks like a proof document (payslip / bank statement / COE). Upload a loan application PDF in the Application field (e.g. testdata/applications/eligible-jane-doe.pdf), and put proofs in the Proof documents field."
      : " Application PDFs need labeled fields such as: Full Name, Age, Monthly Income, Employment Status, Months Employed, Loan Amount, Loan Term Months, Credit Score, Existing Debt.";
    throw new Error(
      `Could not parse application PDF fields: ${missing}.${hint}`
    );
  }

  return parsed.data;
}

export async function parseApplicantPdf(
  bytes: Uint8Array
): Promise<{ application: LoanApplicationInput; rawText: string }> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const rawText = String(text ?? "").trim();
  if (!rawText) {
    throw new Error("No extractable text in application PDF");
  }
  return {
    application: parseApplicantText(rawText),
    rawText,
  };
}
