import { z } from "zod";

const tenureByStatusSchema = z.object({
  atOrBelowThresholdMonths: z.number().int().min(0),
  aboveThresholdMonths: z.number().int().min(0),
});

export const documentVerificationSchema = z.object({
  required: z.boolean().default(true),
  minProofDocuments: z.number().int().min(0).default(1),
  acceptedTypes: z
    .array(
      z.enum([
        "payslip",
        "bank_statement",
        "employment_certificate",
        "unknown",
      ])
    )
    .default(["payslip", "bank_statement", "employment_certificate"]),
  incomeMatchTolerancePercent: z.number().min(0).max(100).default(15),
  requireNameMatch: z.boolean().default(true),
  rejectUnknownTypes: z.boolean().default(true),
});

export const loanRulesSchema = z.object({
  version: z.string().min(1),
  description: z.string().optional(),
  age: z.object({
    min: z.number().int().min(0),
    max: z.number().int().min(0),
  }),
  allowedEmploymentStatuses: z.array(z.string().min(1)).min(1),
  incomeFloorMonthly: z.number().min(0),
  maxLoanAmount: z.number().min(0),
  loanTermMonths: z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1),
  }),
  maxDti: z.number().gt(0).lte(1),
  maxInstallmentToIncomeRatio: z.number().gt(0).lte(1),
  incomeBands: z
    .array(
      z.object({
        maxLoanAmount: z.number().min(0),
        minMonthlyIncome: z.number().min(0),
        label: z.string().min(1),
      })
    )
    .min(1),
  tenure: z.object({
    loanAmountThreshold: z.number().min(0),
    byEmploymentStatus: z.record(tenureByStatusSchema),
  }),
  creditScore: z.object({
    declineBelow: z.number().int().min(0),
    restrictedBand: z.object({
      min: z.number().int().min(0),
      max: z.number().int().min(0),
      maxDti: z.number().gt(0).lte(1),
      maxLoanAmount: z.number().min(0),
    }),
  }),
  documentVerification: documentVerificationSchema.default({}),
});

export type LoanRules = z.infer<typeof loanRulesSchema>;
export type DocumentVerificationConfig = z.infer<
  typeof documentVerificationSchema
>;
export type TenureRequirement = z.infer<typeof tenureByStatusSchema>;
export type ProofDocumentType =
  | "payslip"
  | "bank_statement"
  | "employment_certificate"
  | "unknown";
