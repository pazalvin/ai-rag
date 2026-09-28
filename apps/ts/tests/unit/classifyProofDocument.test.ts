import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyProofDocument } from "../../src/loan/classifyProofDocument.ts";

describe("unit: classifyProofDocument", () => {
  it("classifies a payslip from keywords", () => {
    const text = `
      Monthly Payslip / Pay Slip / Payroll
      Employee Name: Jane Doe
      Employer: Acme Inc
      Gross Pay: 45000
      Net Pay: 42000
      Pay Period: June 2026
      YTD Earnings: 250000
    `;
    const result = classifyProofDocument(text);
    assert.equal(result.type, "payslip");
    assert.equal(result.relatedToLoanCapacity, true);
    assert.ok(result.confidence > 0);
    assert.ok(result.matchedKeywords.includes("payslip") || result.matchedKeywords.includes("net pay"));
  });

  it("classifies a bank statement from keywords", () => {
    const text = `
      Bank Statement / Account Statement
      Account Number: 123456
      Opening Balance: 10000
      Closing Balance: 20000
      Salary Credit: 45000
      Transaction History
    `;
    const result = classifyProofDocument(text);
    assert.equal(result.type, "bank_statement");
    assert.equal(result.relatedToLoanCapacity, true);
  });

  it("classifies an employment certificate from keywords", () => {
    const text = `
      Certificate of Employment
      This is to certify that Jane Doe is currently employed
      Position: Analyst
      Date Hired: 2024-01-01
      Human Resources Department
    `;
    const result = classifyProofDocument(text);
    assert.equal(result.type, "employment_certificate");
    assert.equal(result.relatedToLoanCapacity, true);
  });

  it("marks unrelated text as unknown / not capacity-related", () => {
    const text = `
      Electric Utility Bill
      Amount Due: 3200
      Meter Reading: 99881
    `;
    const result = classifyProofDocument(text);
    assert.equal(result.type, "unknown");
    assert.equal(result.relatedToLoanCapacity, false);
  });
});
