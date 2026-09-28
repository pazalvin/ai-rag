import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../../src/app.ts";
import { assessDocuments } from "../../src/loan/assessDocuments.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..", "..", "..");
const appsDir = path.join(root, "testdata", "applications");
const proofsDir = path.join(root, "testdata", "proofs");

function requireFixture(fullPath: string): void {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing fixture ${fullPath}. Run generate scripts first.`);
  }
}

function readPdf(dir: string, name: string): Uint8Array {
  const full = path.join(dir, name);
  requireFixture(full);
  return new Uint8Array(fs.readFileSync(full));
}

describe("integration: assessDocuments service", () => {
  before(() => {
    requireFixture(path.join(appsDir, "eligible-jane-doe.pdf"));
    requireFixture(path.join(proofsDir, "payslip-jane-doe.pdf"));
    requireFixture(path.join(proofsDir, "utility-bill-unrelated.pdf"));
    requireFixture(path.join(proofsDir, "payslip-income-mismatch.pdf"));
    requireFixture(path.join(proofsDir, "bank-statement-jane-doe.pdf"));
  });

  it("marks FIT when application + matching payslip are valid", async () => {
    const result = await assessDocuments({
      applicationPdf: readPdf(appsDir, "eligible-jane-doe.pdf"),
      applicationFileName: "eligible-jane-doe.pdf",
      proofs: [
        {
          fileName: "payslip-jane-doe.pdf",
          bytes: readPdf(proofsDir, "payslip-jane-doe.pdf"),
        },
      ],
      offline: true,
    });

    assert.equal(result.eligible, true);
    assert.equal(result.documentVerification?.passed, true);
    assert.equal(result.documentVerification?.documents[0]?.type, "payslip");
    assert.equal(result.proofFileNames.includes("payslip-jane-doe.pdf"), true);
  });

  it("marks NOT FIT when proof is unrelated to loan capacity", async () => {
    const result = await assessDocuments({
      applicationPdf: readPdf(appsDir, "eligible-jane-doe.pdf"),
      applicationFileName: "eligible-jane-doe.pdf",
      proofs: [
        {
          fileName: "utility-bill-unrelated.pdf",
          bytes: readPdf(proofsDir, "utility-bill-unrelated.pdf"),
        },
      ],
      offline: true,
    });

    assert.equal(result.ruleCheck.eligible, true);
    assert.equal(result.documentVerification?.passed, false);
    assert.equal(result.eligible, false);
  });

  it("marks NOT FIT when payslip income does not support the claim", async () => {
    const result = await assessDocuments({
      applicationPdf: readPdf(appsDir, "eligible-jane-doe.pdf"),
      applicationFileName: "eligible-jane-doe.pdf",
      proofs: [
        {
          fileName: "payslip-income-mismatch.pdf",
          bytes: readPdf(proofsDir, "payslip-income-mismatch.pdf"),
        },
      ],
      offline: true,
    });

    assert.equal(result.eligible, false);
    assert.equal(result.documentVerification?.passed, false);
  });

  it("accepts a matching bank statement as capacity proof", async () => {
    const result = await assessDocuments({
      applicationPdf: readPdf(appsDir, "eligible-jane-doe.pdf"),
      applicationFileName: "eligible-jane-doe.pdf",
      proofs: [
        {
          fileName: "bank-statement-jane-doe.pdf",
          bytes: readPdf(proofsDir, "bank-statement-jane-doe.pdf"),
        },
      ],
      offline: true,
    });

    assert.equal(result.eligible, true);
    assert.equal(
      result.documentVerification?.documents[0]?.type,
      "bank_statement"
    );
  });
});

describe("integration: POST /api/assess-documents", () => {
  before(() => {
    process.env.ELIGIBILITY_OFFLINE = "1";
    requireFixture(path.join(appsDir, "eligible-jane-doe.pdf"));
    requireFixture(path.join(proofsDir, "payslip-jane-doe.pdf"));
    requireFixture(path.join(proofsDir, "utility-bill-unrelated.pdf"));
  });

  it("returns 400 when proof documents are missing", async () => {
    const app = createApp();
    const form = new FormData();
    form.append(
      "application",
      new File([readPdf(appsDir, "eligible-jane-doe.pdf")], "eligible-jane-doe.pdf", {
        type: "application/pdf",
      })
    );

    const res = await app.request("/api/assess-documents", {
      method: "POST",
      body: form,
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /missing proof/i);
  });

  it("returns FIT over HTTP for application + matching payslip", async () => {
    const app = createApp();
    const form = new FormData();
    form.append(
      "application",
      new File([readPdf(appsDir, "eligible-jane-doe.pdf")], "eligible-jane-doe.pdf", {
        type: "application/pdf",
      })
    );
    form.append(
      "proofs",
      new File([readPdf(proofsDir, "payslip-jane-doe.pdf")], "payslip-jane-doe.pdf", {
        type: "application/pdf",
      })
    );

    const res = await app.request("/api/assess-documents", {
      method: "POST",
      body: form,
    });
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      eligible: boolean;
      documentVerification?: { passed: boolean };
      proofFileNames?: string[];
    };
    assert.equal(body.eligible, true);
    assert.equal(body.documentVerification?.passed, true);
    assert.deepEqual(body.proofFileNames, ["payslip-jane-doe.pdf"]);
  });

  it("returns NOT FIT over HTTP for unrelated utility bill proof", async () => {
    const app = createApp();
    const form = new FormData();
    form.append(
      "application",
      new File([readPdf(appsDir, "eligible-jane-doe.pdf")], "eligible-jane-doe.pdf", {
        type: "application/pdf",
      })
    );
    form.append(
      "proofs",
      new File(
        [readPdf(proofsDir, "utility-bill-unrelated.pdf")],
        "utility-bill-unrelated.pdf",
        { type: "application/pdf" }
      )
    );

    const res = await app.request("/api/assess-documents", {
      method: "POST",
      body: form,
    });
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      eligible: boolean;
      documentVerification?: { passed: boolean };
    };
    assert.equal(body.eligible, false);
    assert.equal(body.documentVerification?.passed, false);
  });
});
