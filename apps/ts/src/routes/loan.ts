import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  assessDocuments,
  isOfflineEligibilityMode,
} from "../loan/assessDocuments.js";
import { checkEligibility } from "../loan/checkEligibility.js";
import { extractPdfText } from "../loan/extractPdfText.js";
import { parseApplicantPdf } from "../loan/parseApplicantPdf.js";
import type { ProofDocumentInput } from "../loan/verifyProofDocuments.js";
import { loanApplicationSchema } from "../schemas/loan.js";

export const loanRoutes = new Hono();

function isPdfFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".pdf") ||
    file.type === "application/pdf"
  );
}

async function collectProofFiles(
  body: Record<string, unknown>
): Promise<Array<{ fileName: string; bytes: Uint8Array }>> {
  const proofs: Array<{ fileName: string; bytes: Uint8Array }> = [];
  const candidates = [body.proofs, body.proof, body.documents].flatMap((v) => {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  });

  for (const item of candidates) {
    if (!(item instanceof File)) continue;
    if (!isPdfFile(item)) {
      throw new Error(`Proof file must be PDF: ${item.name}`);
    }
    const bytes = new Uint8Array(await item.arrayBuffer());
    proofs.push({ fileName: item.name, bytes });
  }

  return proofs;
}

async function proofsAsText(
  proofs: Array<{ fileName: string; bytes: Uint8Array }>
): Promise<ProofDocumentInput[]> {
  const out: ProofDocumentInput[] = [];
  for (const proof of proofs) {
    out.push({
      fileName: proof.fileName,
      text: await extractPdfText(proof.bytes),
    });
  }
  return out;
}

loanRoutes.post(
  "/check-eligibility",
  zValidator("json", loanApplicationSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: "Invalid application",
          detail: result.error.flatten(),
        },
        400
      );
    }
  }),
  async (c) => {
    try {
      const application = c.req.valid("json");
      const offline = isOfflineEligibilityMode();
      const result = await checkEligibility(application, {
        source: "form",
        verifyDocuments: false,
        useLlm: !offline,
        persist: !offline,
      });
      return c.json(result);
    } catch (err) {
      console.error("Eligibility check failed:", err);
      return c.json(
        {
          error: "Eligibility check failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        500
      );
    }
  }
);

loanRoutes.post("/check-eligibility-pdf", async (c) => {
  try {
    const body = await c.req.parseBody({ all: true });
    const file = body.file;

    if (!file || !(file instanceof File)) {
      return c.json(
        {
          error: "Missing application PDF",
          detail: "Upload field `file` is required",
        },
        400
      );
    }

    if (!isPdfFile(file)) {
      return c.json({ error: "Only PDF uploads are supported" }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { application, rawText } = await parseApplicantPdf(bytes);
    const proofFiles = await collectProofFiles(body as Record<string, unknown>);
    const proofDocuments = await proofsAsText(proofFiles);
    const offline = isOfflineEligibilityMode();

    const result = await checkEligibility(application, {
      source: proofDocuments.length > 0 ? "documents" : "pdf",
      proofDocuments,
      verifyDocuments: proofDocuments.length > 0,
      useLlm: !offline,
      persist: !offline,
    });

    return c.json({
      ...result,
      uploadedFileName: file.name,
      extractedTextPreview: rawText.slice(0, 500),
    });
  } catch (err) {
    console.error("PDF eligibility check failed:", err);
    return c.json(
      {
        error: "PDF eligibility check failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

loanRoutes.post("/assess-documents", async (c) => {
  try {
    const body = await c.req.parseBody({ all: true });
    const applicationFile = body.application ?? body.file;

    if (!applicationFile || !(applicationFile instanceof File)) {
      return c.json(
        {
          error: "Missing application PDF",
          detail: "Upload field `application` (or `file`) is required",
        },
        400
      );
    }

    if (!isPdfFile(applicationFile)) {
      return c.json({ error: "Application must be a PDF" }, 400);
    }

    const proofFiles = await collectProofFiles(body as Record<string, unknown>);
    if (proofFiles.length === 0) {
      return c.json(
        {
          error: "Missing proof documents",
          detail:
            "Upload at least one proof PDF in field `proofs` (payslip, bank statement, or employment certificate).",
        },
        400
      );
    }

    const appBytes = new Uint8Array(await applicationFile.arrayBuffer());
    const result = await assessDocuments({
      applicationPdf: appBytes,
      applicationFileName: applicationFile.name,
      proofs: proofFiles,
      offline: isOfflineEligibilityMode(),
    });

    return c.json(result);
  } catch (err) {
    console.error("Document assessment failed:", err);
    return c.json(
      {
        error: "Document assessment failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});
