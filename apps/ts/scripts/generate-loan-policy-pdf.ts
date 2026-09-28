/**
 * Generates a sample company loan underwriting PDF for RAG guidelines.
 * Run: npx tsx scripts/generate-loan-policy-pdf.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "guidelines",
  "loan-underwriting-guidelines.pdf"
);

type Section = { heading: string; body: string[] };

const sections: Section[] = [
  {
    heading: "1. Purpose",
    body: [
      "This document is the official Personal Loan Underwriting Guidelines for Guideline Gate Financial. Use these rules when reviewing any personal loan application. Automated systems and human underwriters must apply every rule below. Income and work history must fit the loan value requested.",
    ],
  },
  {
    heading: "2. Eligibility age",
    body: [
      "Applicants must be at least 21 years old and not older than 65 at the time of application.",
      "Applications outside this age range must be declined.",
    ],
  },
  {
    heading: "3. Employment and work requirements",
    body: [
      "Accepted employment statuses: employed, self-employed, and contract. Unemployed and student applicants are not eligible.",
      "Employed or contract: at least 6 months continuous work with the current employer for loans up to 200,000; at least 12 months for loans above 200,000.",
      "Self-employed: at least 12 months continuous business operation for loans up to 200,000; at least 24 months for loans above 200,000.",
      "If tenure does not match the requested loan amount, decline or require a lower loan amount in the band the applicant qualifies for.",
    ],
  },
  {
    heading: "4. Minimum salary and income capacity vs loan amount",
    body: [
      "Absolute income floor: monthly income must be at least 20,000. Below this floor, decline regardless of credit score.",
      "Income must also fit the loan value. Annual income = monthlyIncome x 12.",
      "Loan up to 100,000: annual income at least 240,000 (monthly at least 20,000).",
      "Loan 100,001 to 250,000: annual income at least 480,000 (monthly at least 40,000).",
      "Loan 250,001 to 500,000: annual income at least 720,000 (monthly at least 60,000).",
      "If monthly income is below the band for the requested loan amount, decline or require a lower loan amount that matches the income band.",
    ],
  },
  {
    heading: "5. Credit score bands",
    body: [
      "Credit score below 580: decline the application.",
      "Credit score 580 to 649: may approve only if debt-to-income is under 30% and the loan amount is at most 150,000.",
      "Credit score 650 to 719: standard approval path if all other rules pass.",
      "Credit score 720 and above: preferred pricing path if all other rules pass.",
    ],
  },
  {
    heading: "6. Debt-to-income (DTI)",
    body: [
      "Compute DTI as: (existingDebt + loanAmount) / (monthlyIncome x 12).",
      "Maximum allowed DTI is 40%. If DTI exceeds 40%, decline the application.",
      "DTI is an additional check on top of the income-capacity bands above.",
    ],
  },
  {
    heading: "7. Maximum loan amount, term, and installment affordability",
    body: [
      "Maximum loan amount is 500,000. Loan term must be between 12 and 60 months inclusive.",
      "Amounts above 500,000 or terms outside 12 to 60 months must be declined.",
      "Estimated monthly installment (loanAmount / loanTermMonths) must not exceed 40% of monthlyIncome. If it exceeds 40%, decline.",
    ],
  },
  {
    heading: "8. Decision order",
    body: [
      "1) Confirm age and employment status.",
      "2) Confirm work tenure matches the requested loan amount.",
      "3) Confirm absolute income floor and income-capacity band for the loan amount.",
      "4) Confirm amount, term, and installment affordability.",
      "5) Confirm credit score band rules.",
      "6) Confirm DTI is within 40%.",
      "7) Approve only when all checks pass; otherwise decline and cite the failed rule.",
    ],
  },
  {
    heading: "9. Document control",
    body: [
      "Policy owner: Credit Risk Committee.",
      "Effective date: January 1, 2026.",
      "Version: 1.1 — sample guidelines with salary and work requirements tied to loan value.",
    ],
  },
];

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 56, bottom: 56, left: 56, right: 56 },
  info: {
    Title: "Personal Loan Underwriting Guidelines",
    Author: "Guideline Gate Financial",
    Subject: "Sample loan eligibility policy for RAG",
  },
});

const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

doc
  .font("Helvetica-Bold")
  .fontSize(18)
  .text("Guideline Gate Financial", { align: "left" });

doc.moveDown(0.35);
doc
  .font("Helvetica-Bold")
  .fontSize(14)
  .text("Personal Loan Underwriting Guidelines");

doc.moveDown(0.25);
doc
  .font("Helvetica")
  .fontSize(10)
  .fillColor("#444444")
  .text("Confidential — Internal Use Only  |  Version 1.1  |  Effective January 1, 2026");

doc.moveDown(0.8);
doc.fillColor("#000000");

for (const section of sections) {
  doc.font("Helvetica-Bold").fontSize(12).text(section.heading);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10);
  for (const paragraph of section.body) {
    doc.text(paragraph, { align: "left", lineGap: 2 });
    doc.moveDown(0.35);
  }
  doc.moveDown(0.35);
}

doc.end();

await new Promise<void>((resolve, reject) => {
  stream.on("finish", () => resolve());
  stream.on("error", reject);
});

console.log(`Wrote ${outPath}`);
