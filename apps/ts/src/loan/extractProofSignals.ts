import type { ProofDocumentType } from "./rulesSchema.js";

export type ExtractedProofSignals = {
  documentType: ProofDocumentType;
  employeeOrAccountName?: string;
  employerName?: string;
  /** Best guess of monthly income / salary credit from the document. */
  monthlyIncomeEvidence?: number;
  amountsFound: number[];
  notes: string[];
};

function pickLabeledAmount(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `${label.replace(/\s+/g, "\\s+")}\\s*[:\\-]?\\s*(?:PHP|₱|USD|\\$)?\\s*([0-9][0-9,]*(?:\\.\\d+)?)`,
      "i"
    );
    const match = text.match(re);
    if (match?.[1]) {
      return Number(match[1].replace(/,/g, ""));
    }
  }
  return undefined;
}

function pickLabeledString(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `${label.replace(/\s+/g, "\\s+")}\\s*[:\\-]?\\s*(.+?)(?=(?:\\s{2,}|\\n|[A-Z][a-z]+\\s*:)|$)`,
      "i"
    );
    const match = text.match(re);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }
  return undefined;
}

function collectCurrencyAmounts(text: string): number[] {
  const amounts: number[] = [];
  const re = /(?:PHP|₱|USD|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d+)?|[0-9]{4,}(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const n = Number(match[1]!.replace(/,/g, ""));
    if (!Number.isNaN(n) && n >= 1000) {
      amounts.push(Math.round(n));
    }
  }
  return [...new Set(amounts)].sort((a, b) => b - a);
}

/**
 * Extract income / identity signals from a classified proof document.
 */
export function extractProofSignals(
  text: string,
  documentType: ProofDocumentType
): ExtractedProofSignals {
  const notes: string[] = [];
  const amountsFound = collectCurrencyAmounts(text);

  const employeeOrAccountName =
    pickLabeledString(text, [
      "Employee Name",
      "Account Name",
      "Account Holder",
      "Name of Employee",
      "Full Name",
      "Name",
    ]) || undefined;

  const employerName =
    pickLabeledString(text, [
      "Employer",
      "Company Name",
      "Employer Name",
      "Company",
    ]) || undefined;

  let monthlyIncomeEvidence: number | undefined;

  if (documentType === "payslip") {
    monthlyIncomeEvidence =
      pickLabeledAmount(text, [
        "Net Pay",
        "Net Salary",
        "Take Home Pay",
        "Gross Pay",
        "Basic Salary",
        "Monthly Salary",
      ]) ?? amountsFound[0];
    if (monthlyIncomeEvidence) {
      notes.push(`Payslip income evidence: ${monthlyIncomeEvidence}`);
    }
  } else if (documentType === "bank_statement") {
    monthlyIncomeEvidence =
      pickLabeledAmount(text, [
        "Salary Credit",
        "Payroll Credit",
        "Monthly Salary Credit",
        "Average Monthly Credit",
        "Salary Deposit",
      ]) ?? amountsFound[0];
    if (monthlyIncomeEvidence) {
      notes.push(`Bank statement income evidence: ${monthlyIncomeEvidence}`);
    }
  } else if (documentType === "employment_certificate") {
    monthlyIncomeEvidence = pickLabeledAmount(text, [
      "Monthly Salary",
      "Basic Salary",
      "Compensation",
      "Salary",
    ]);
    if (monthlyIncomeEvidence) {
      notes.push(`COE income evidence: ${monthlyIncomeEvidence}`);
    } else {
      notes.push("COE found but no salary amount extracted.");
    }
  } else {
    notes.push("Document type unknown — limited extraction.");
  }

  return {
    documentType,
    employeeOrAccountName,
    employerName,
    monthlyIncomeEvidence,
    amountsFound: amountsFound.slice(0, 10),
    notes,
  };
}
