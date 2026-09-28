import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadLoanRules } from "../../src/loan/loadRules.ts";
import { verifyProofDocuments } from "../../src/loan/verifyProofDocuments.ts";
import type { LoanApplicationInput } from "../../src/schemas/loan.ts";

const jane: LoanApplicationInput = {
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

const matchingPayslip = `
  Payslip / Pay Slip / Payroll
  Employee Name: Jane Doe
  Employer: Acme Manufacturing Inc.
  Pay Period: June 2026
  Gross Pay: 45000
  Net Pay: 45000
  Basic Salary: 45000
  YTD Earnings: 270000
`;

describe("unit: verifyProofDocuments", () => {
  it("passes when payslip is related and income/name match", () => {
    const result = verifyProofDocuments(jane, [
      { fileName: "payslip.txt", text: matchingPayslip },
    ]);
    assert.equal(result.passed, true);
    assert.equal(result.documents[0]?.type, "payslip");
    assert.equal(result.documents[0]?.accepted, true);
    assert.equal(result.documents[0]?.issues.length, 0);
  });

  it("fails when no proof documents are provided but rules require them", () => {
    const rules = loadLoanRules();
    assert.equal(rules.documentVerification.required, true);
    const result = verifyProofDocuments(jane, []);
    assert.equal(result.passed, false);
    assert.ok(result.summary.some((s) => /at least 1 proof/i.test(s)));
  });

  it("fails when document is not related to loan capacity", () => {
    const result = verifyProofDocuments(jane, [
      {
        fileName: "utility.txt",
        text: "Electric Utility Bill Amount Due: 3200 Meter Reading: 1",
      },
    ]);
    assert.equal(result.passed, false);
    assert.equal(result.documents[0]?.relatedToLoanCapacity, false);
  });

  it("fails when income on payslip is outside tolerance", () => {
    const result = verifyProofDocuments(jane, [
      {
        fileName: "low-payslip.txt",
        text: `
          Payslip / Pay Slip / Payroll
          Employee Name: Jane Doe
          Employer: Acme
          Gross Pay: 18000
          Net Pay: 18000
          Basic Salary: 18000
          YTD Earnings: 50000
        `,
      },
    ]);
    assert.equal(result.passed, false);
    assert.ok(
      result.documents[0]?.issues.some((i) => /outside .* of claimed/i.test(i))
    );
  });

  it("fails when name on document does not match applicant", () => {
    const result = verifyProofDocuments(jane, [
      {
        fileName: "other-person.txt",
        text: `
          Payslip / Pay Slip / Payroll
          Employee Name: John Smith
          Employer: Acme
          Net Pay: 45000
          Gross Pay: 45000
          Basic Salary: 45000
          YTD Earnings: 100000
        `,
      },
    ]);
    assert.equal(result.passed, false);
    assert.ok(
      result.documents[0]?.issues.some((i) => /does not match applicant/i.test(i))
    );
  });

  it("can skip verification when disabled in rules", () => {
    const rules = {
      ...loadLoanRules(),
      documentVerification: {
        ...loadLoanRules().documentVerification,
        required: false,
      },
    };
    const result = verifyProofDocuments(jane, [], rules);
    assert.equal(result.passed, true);
    assert.equal(result.required, false);
  });
});
