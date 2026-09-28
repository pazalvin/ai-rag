import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractProofSignals } from "../../src/loan/extractProofSignals.ts";

describe("unit: extractProofSignals", () => {
  it("extracts net pay and employee name from a payslip", () => {
    const text = `
      Payslip
      Employee Name: Jane Doe
      Employer: Acme Manufacturing Inc.
      Net Pay: 45000
      Gross Pay: 48000
      Basic Salary: 45000
    `;
    const signals = extractProofSignals(text, "payslip");
    assert.equal(signals.employeeOrAccountName, "Jane Doe");
    assert.equal(signals.monthlyIncomeEvidence, 45000);
    assert.ok(signals.amountsFound.includes(45000));
  });

  it("extracts salary credit from a bank statement", () => {
    const text = `
      Bank Statement
      Account Name: Jane Doe
      Salary Credit: 45000
      Closing Balance: 90000
    `;
    const signals = extractProofSignals(text, "bank_statement");
    assert.equal(signals.employeeOrAccountName, "Jane Doe");
    assert.equal(signals.monthlyIncomeEvidence, 45000);
  });

  it("extracts monthly salary from an employment certificate when present", () => {
    const text = `
      Certificate of Employment
      Employee Name: Jane Doe
      Monthly Salary: 45000
      Currently employed as Analyst
    `;
    const signals = extractProofSignals(text, "employment_certificate");
    assert.equal(signals.monthlyIncomeEvidence, 45000);
  });
});
