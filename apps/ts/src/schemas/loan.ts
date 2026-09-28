import { z } from "zod";

export const loanApplicationSchema = z.object({
  fullName: z.string().trim().min(1),
  age: z.coerce.number().int().min(18).max(100),
  monthlyIncome: z.coerce.number().int().min(0),
  employmentStatus: z
    .string()
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase()),
  monthsEmployed: z.coerce.number().int().min(0).max(600),
  loanAmount: z.coerce.number().int().min(0),
  loanTermMonths: z.coerce.number().int().min(1).max(120),
  creditScore: z.coerce.number().int().min(300).max(850),
  existingDebt: z.coerce.number().int().min(0),
});

export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;
