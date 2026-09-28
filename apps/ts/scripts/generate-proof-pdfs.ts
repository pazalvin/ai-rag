/**
 * Sample proof documents for capacity verification testing.
 * Run: npm run generate:proof-pdfs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "..", "..", "testdata", "proofs");

type Doc = {
  fileName: string;
  title: string;
  expected: string;
  lines: string[];
};

const docs: Doc[] = [
  {
    fileName: "payslip-jane-doe.pdf",
    title: "Monthly Payslip — Jane Doe",
    expected: "ACCEPT with eligible-jane-doe.pdf",
    lines: [
      "Company Name: Acme Manufacturing Inc.",
      "Payslip / Pay Slip / Payroll",
      "Employee Name: Jane Doe",
      "Employer: Acme Manufacturing Inc.",
      "Pay Period: June 1 2026 - June 30 2026",
      "Basic Salary: 45000",
      "Gross Pay: 45000",
      "Net Pay: 45000",
      "YTD Earnings: 270000",
    ],
  },
  {
    fileName: "bank-statement-jane-doe.pdf",
    title: "Bank Statement — Jane Doe",
    expected: "ACCEPT with eligible-jane-doe.pdf",
    lines: [
      "Bank Statement / Account Statement",
      "Account Name: Jane Doe",
      "Account Number: 1234567890",
      "Opening Balance: 80000",
      "Salary Credit: 45000",
      "Payroll Credit: 45000",
      "Deposit: 45000",
      "Closing Balance: 92000",
      "Transaction History included",
      "Available Balance: 92000",
    ],
  },
  {
    fileName: "employment-certificate-jane-doe.pdf",
    title: "Certificate of Employment — Jane Doe",
    expected: "Related type; pair with payslip/bank for income evidence",
    lines: [
      "Certificate of Employment",
      "This is to certify that the employee below is currently employed.",
      "Employee Name: Jane Doe",
      "Employer Name: Acme Manufacturing Inc.",
      "Position: Operations Analyst",
      "Date Hired: January 15 2025",
      "Monthly Salary: 45000",
      "Human Resources Department",
      "Tenure: 18 months continuous employment",
    ],
  },
  {
    fileName: "payslip-mark-rivera.pdf",
    title: "Monthly Payslip — Mark Rivera",
    expected: "ACCEPT with eligible-high-income-mark.pdf",
    lines: [
      "Payslip / Pay Slip / Payroll",
      "Employee Name: Mark Rivera",
      "Employer: Northwind Logistics Corp.",
      "Pay Period: June 2026",
      "Basic Salary: 75000",
      "Gross Pay: 75000",
      "Net Pay: 75000",
      "YTD Earnings: 450000",
    ],
  },
  {
    fileName: "payslip-income-mismatch.pdf",
    title: "Monthly Payslip — Jane Doe (low pay)",
    expected: "REJECT with Jane application (income mismatch)",
    lines: [
      "Payslip / Pay Slip / Payroll",
      "Employee Name: Jane Doe",
      "Employer: Acme Manufacturing Inc.",
      "Pay Period: June 2026",
      "Gross Pay: 18000",
      "Net Pay: 18000",
      "Basic Salary: 18000",
      "YTD Earnings: 54000",
    ],
  },
  {
    fileName: "payslip-wrong-name.pdf",
    title: "Monthly Payslip — wrong person",
    expected: "REJECT with Jane application (name mismatch)",
    lines: [
      "Payslip / Pay Slip / Payroll",
      "Employee Name: John Smith",
      "Employer: Acme Manufacturing Inc.",
      "Pay Period: June 2026",
      "Gross Pay: 45000",
      "Net Pay: 45000",
      "Basic Salary: 45000",
      "YTD Earnings: 270000",
    ],
  },
  {
    fileName: "utility-bill-unrelated.pdf",
    title: "Electric Utility Bill (unrelated)",
    expected: "REJECT — not related to loan capacity",
    lines: [
      "Electric Utility Bill",
      "Service Address: 12 Oak Street",
      "Billing Period: June 2026",
      "Amount Due: 3200",
      "Meter Reading: 44521",
      "This is not a payslip or bank statement.",
    ],
  },
  {
    fileName: "grocery-receipt-unrelated.pdf",
    title: "Store Receipt (unrelated)",
    expected: "REJECT — not related to loan capacity",
    lines: [
      "Supermarket Sales Receipt",
      "Items purchased: groceries",
      "Total Amount: 2450",
      "Payment method: cash",
      "Thank you for shopping",
    ],
  },
];

async function writePdf(doc: Doc): Promise<string> {
  const outPath = path.join(outDir, doc.fileName);
  const pdf = new PDFDocument({
    size: "LETTER",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
  });
  const stream = fs.createWriteStream(outPath);
  pdf.pipe(stream);

  pdf.font("Helvetica-Bold").fontSize(16).text("Guideline Gate Samples");
  pdf.moveDown(0.3);
  pdf.font("Helvetica-Bold").fontSize(12).text(doc.title);
  pdf.moveDown(0.2);
  pdf.font("Helvetica").fontSize(10).fillColor("#444444").text(`Expected: ${doc.expected}`);
  pdf.moveDown(0.8).fillColor("#000000");
  pdf.font("Helvetica").fontSize(11);
  for (const line of doc.lines) {
    pdf.text(line);
    pdf.moveDown(0.35);
  }

  pdf.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return outPath;
}

fs.mkdirSync(outDir, { recursive: true });
for (const doc of docs) {
  console.log(`Wrote ${await writePdf(doc)}`);
}
