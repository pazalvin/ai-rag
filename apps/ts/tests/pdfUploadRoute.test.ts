import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.ts";
import { parseApplicantPdf } from "../src/loan/parseApplicantPdf.ts";
import { checkEligibility } from "../src/loan/checkEligibility.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePdf = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "testdata",
  "applications",
  "eligible-jane-doe.pdf"
);

describe("POST /api/check-eligibility-pdf", () => {
  before(() => {
    if (!fs.existsSync(samplePdf)) {
      throw new Error("Run npm run generate:applicant-pdfs first");
    }
  });

  it("parses an application PDF and returns fit decision offline", async () => {
    const bytes = fs.readFileSync(samplePdf);
    const { application } = await parseApplicantPdf(new Uint8Array(bytes));
    const result = await checkEligibility(application, {
      useLlm: false,
      persist: false,
      source: "pdf",
    });

    assert.equal(result.eligible, true);
    assert.equal(result.fullName, "Jane Doe");
  });

  it("rejects requests without a PDF file", async () => {
    const app = createApp();
    const missing = await app.request("/api/check-eligibility-pdf", {
      method: "POST",
      body: new FormData(),
    });
    assert.equal(missing.status, 400);
  });
});
