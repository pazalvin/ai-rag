import type { EligibilityResponse } from "./checkEligibility.js";
import { checkEligibility } from "./checkEligibility.js";
import { extractPdfText } from "./extractPdfText.js";
import { parseApplicantPdf } from "./parseApplicantPdf.js";
import type { ProofDocumentInput } from "./verifyProofDocuments.js";

export type AssessDocumentsInput = {
  applicationPdf: Uint8Array;
  applicationFileName?: string;
  proofs: Array<{ fileName: string; bytes: Uint8Array }>;
  /** Skip Ollama + DB (used by tests). */
  offline?: boolean;
};

export type AssessDocumentsResult = EligibilityResponse & {
  uploadedFileName: string;
  extractedTextPreview: string;
  proofFileNames: string[];
};

export function isOfflineEligibilityMode(): boolean {
  return process.env.ELIGIBILITY_OFFLINE === "1";
}

/**
 * Full pipeline: parse application PDF + verify proof PDFs + eligibility.
 */
export async function assessDocuments(
  input: AssessDocumentsInput
): Promise<AssessDocumentsResult> {
  if (input.proofs.length === 0) {
    throw new Error(
      "At least one proof PDF is required (payslip, bank statement, or employment certificate)."
    );
  }

  const { application, rawText } = await parseApplicantPdf(input.applicationPdf);

  const proofDocuments: ProofDocumentInput[] = [];
  for (const proof of input.proofs) {
    const text = await extractPdfText(proof.bytes);
    proofDocuments.push({ fileName: proof.fileName, text });
  }

  const offline = input.offline ?? isOfflineEligibilityMode();
  const result = await checkEligibility(application, {
    source: "documents",
    proofDocuments,
    verifyDocuments: true,
    useLlm: !offline,
    persist: !offline,
  });

  return {
    ...result,
    uploadedFileName: input.applicationFileName ?? "application.pdf",
    extractedTextPreview: rawText.slice(0, 500),
    proofFileNames: proofDocuments.map((p) => p.fileName),
  };
}
