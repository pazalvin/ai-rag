import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it, before } from "node:test";
import { fileURLToPath } from "node:url";
import { parseApplicantPdf, parseApplicantText } from "../src/loan/parseApplicantPdf.ts";
import { evaluateRules } from "../src/loan/evaluateRules.ts";
import { checkEligibility } from "../src/loan/checkEligibility.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.join(__dirname, "..", "..", "..", "testdata", "applications");

const cases = [
  {
    file: "eligible-jane-doe.pdf",
    expectFit: true,
    name: "Jane Doe",
  },
  {
    file: "ineligible-low-income.pdf",
    expectFit: false,
    name: "Low Income Leo",
  },
  {
    file: "ineligible-short-tenure.pdf",
    expectFit: false,
    name: "Short Tenure Sam",
  },
  {
    file: "ineligible-unemployed.pdf",
    expectFit: false,
    name: "Unemployed Uma",
  },
] as const;

describe("parseApplicantText", () => {
  it("parses labeled application fields", () => {
    const text = `
Full Name: Alex Rivera
Age: 40
Monthly Income: 60000
Employment Status: employed
Months Employed: 24
Loan Amount: 250000
Loan Term Months: 48
Credit Score: 740
Existing Debt: 20000
`;
    const app = parseApplicantText(text);
    assert.equal(app.fullName, "Alex Rivera");
    assert.equal(app.monthlyIncome, 60000);
    assert.equal(app.loanAmount, 250000);
  });
});

describe("PDF loan application suite (realtime fit)", () => {
  before(() => {
    for (const c of cases) {
      const full = path.join(appsDir, c.file);
      if (!fs.existsSync(full)) {
        throw new Error(
          `Missing ${full}. Run: npm run generate:applicant-pdfs`
        );
      }
    }
  });

  for (const c of cases) {
    it(`parses ${c.file} and reports fit=${c.expectFit}`, async () => {
      const bytes = new Uint8Array(
        fs.readFileSync(path.join(appsDir, c.file))
      );
      const { application } = await parseApplicantPdf(bytes);
      assert.equal(application.fullName, c.name);

      const rules = evaluateRules(application);
      assert.equal(rules.eligible, c.expectFit);

      const result = await checkEligibility(application, {
        useLlm: false,
        persist: false,
        source: "pdf",
      });
      assert.equal(result.eligible, c.expectFit);
      assert.equal(result.ruleCheck.eligible, c.expectFit);
      assert.equal(result.source, "pdf");
    });
  }
});
