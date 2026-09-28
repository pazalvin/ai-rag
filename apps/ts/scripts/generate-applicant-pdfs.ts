/**
 * Generate sample applicant PDFs for manual + automated testing.
 * Run: npm run generate:applicant-pdfs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "..", "..", "testdata", "applications");

type Applicant = {
  fileName: string;
  title: string;
  expected: string;
  fields: Record<string, string | number>;
};

const applicants: Applicant[] = [
  {
    fileName: "eligible-jane-doe.pdf",
    title: "Loan Application — Jane Doe",
    expected: "FIT when paired with matching payslip/bank statement",
    fields: {
      "Full Name": "Jane Doe",
      Age: 32,
      "Monthly Income": 45000,
      "Employment Status": "employed",
      "Months Employed": 18,
      "Loan Amount": 200000,
      "Loan Term Months": 36,
      "Credit Score": 720,
      "Existing Debt": 15000,
    },
  },
  {
    fileName: "eligible-high-income-mark.pdf",
    title: "Loan Application — Mark Rivera",
    expected: "FIT for larger loan when income band + tenure OK",
    fields: {
      "Full Name": "Mark Rivera",
      Age: 40,
      "Monthly Income": 75000,
      "Employment Status": "employed",
      "Months Employed": 36,
      "Loan Amount": 400000,
      "Loan Term Months": 48,
      "Credit Score": 760,
      "Existing Debt": 20000,
    },
  },
  {
    fileName: "ineligible-low-income.pdf",
    title: "Loan Application — Low Income Leo",
    expected: "NOT FIT (income below band for 200k loan)",
    fields: {
      "Full Name": "Low Income Leo",
      Age: 28,
      "Monthly Income": 22000,
      "Employment Status": "employed",
      "Months Employed": 24,
      "Loan Amount": 200000,
      "Loan Term Months": 36,
      "Credit Score": 700,
      "Existing Debt": 5000,
    },
  },
  {
    fileName: "ineligible-short-tenure.pdf",
    title: "Loan Application — Short Tenure Sam",
    expected: "NOT FIT (work tenure too short)",
    fields: {
      "Full Name": "Short Tenure Sam",
      Age: 30,
      "Monthly Income": 50000,
      "Employment Status": "employed",
      "Months Employed": 3,
      "Loan Amount": 180000,
      "Loan Term Months": 24,
      "Credit Score": 710,
      "Existing Debt": 10000,
    },
  },
  {
    fileName: "ineligible-unemployed.pdf",
    title: "Loan Application — Unemployed Uma",
    expected: "NOT FIT (unemployed status)",
    fields: {
      "Full Name": "Unemployed Uma",
      Age: 35,
      "Monthly Income": 0,
      "Employment Status": "unemployed",
      "Months Employed": 0,
      "Loan Amount": 50000,
      "Loan Term Months": 12,
      "Credit Score": 680,
      "Existing Debt": 0,
    },
  },
  {
    fileName: "ineligible-high-dti.pdf",
    title: "Loan Application — High DTI Dana",
    expected: "NOT FIT (DTI above 40%)",
    fields: {
      "Full Name": "High DTI Dana",
      Age: 34,
      "Monthly Income": 40000,
      "Employment Status": "employed",
      "Months Employed": 24,
      "Loan Amount": 250000,
      "Loan Term Months": 36,
      "Credit Score": 700,
      "Existing Debt": 200000,
    },
  },
];

async function writeApplicantPdf(applicant: Applicant): Promise<string> {
  const outPath = path.join(outDir, applicant.fileName);
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
  });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.font("Helvetica-Bold").fontSize(16).text("Guideline Gate Financial");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(12).text("Personal Loan Application");
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10).fillColor("#444444").text(applicant.title);
  doc.moveDown(0.2);
  doc.text(`Expected result: ${applicant.expected}`);
  doc.moveDown(0.8).fillColor("#000000");

  doc.font("Helvetica").fontSize(11);
  for (const [label, value] of Object.entries(applicant.fields)) {
    doc.text(`${label}: ${value}`);
    doc.moveDown(0.35);
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return outPath;
}

fs.mkdirSync(outDir, { recursive: true });

for (const applicant of applicants) {
  const out = await writeApplicantPdf(applicant);
  console.log(`Wrote ${out}`);
}
