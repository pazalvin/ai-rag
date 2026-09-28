import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRules } from "../src/loan/evaluateRules.ts";
import { loadLoanRules } from "../src/loan/loadRules.ts";
import type { LoanRules } from "../src/loan/rulesSchema.ts";
import type { LoanApplicationInput } from "../src/schemas/loan.ts";

const base: LoanApplicationInput = {
  fullName: "Jane Doe",
  age: 32,
  monthlyIncome: 45000,
  employmentStatus: "employed",
  monthsEmployed: 18,
  loanAmount: 200000,
  loanTermMonths: 36,
  creditScore: 720,
  existingDebt: 15000,
};

describe("evaluateRules", () => {
  it("marks a strong applicant as FIT using configured rules", () => {
    const result = evaluateRules(base);
    assert.equal(result.eligible, true);
    assert.ok(result.rulesVersion);
  });

  it("rejects income below the band for the loan amount", () => {
    const result = evaluateRules({
      ...base,
      fullName: "Low Income Leo",
      monthlyIncome: 22000,
      loanAmount: 200000,
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((r) => /below 40000/i.test(r)));
  });

  it("rejects short work tenure", () => {
    const result = evaluateRules({
      ...base,
      fullName: "Short Tenure Sam",
      monthsEmployed: 3,
      loanAmount: 180000,
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((r) => /tenure/i.test(r)));
  });

  it("rejects unemployed applicants", () => {
    const result = evaluateRules({
      ...base,
      fullName: "Unemployed Uma",
      employmentStatus: "unemployed",
      monthlyIncome: 0,
      monthsEmployed: 0,
      loanAmount: 50000,
      existingDebt: 0,
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((r) => /unemployed/i.test(r)));
  });

  it("honors an in-memory rules override without editing the JSON file", () => {
    const rules: LoanRules = {
      ...loadLoanRules(),
      version: "test-override",
      incomeFloorMonthly: 100_000,
    };

    const result = evaluateRules(base, rules);
    assert.equal(result.eligible, false);
    assert.equal(result.rulesVersion, "test-override");
    assert.ok(result.reasons.some((r) => /100000 floor/i.test(r)));
  });
});
