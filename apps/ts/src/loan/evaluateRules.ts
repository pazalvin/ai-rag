import type { LoanApplicationInput } from "../schemas/loan.js";
import { loadLoanRules } from "./loadRules.js";
import type { LoanRules } from "./rulesSchema.js";

export type RuleCheckResult = {
  eligible: boolean;
  reasons: string[];
  matched_rules: string[];
  rulesVersion?: string;
};

/**
 * Deterministic underwriting against configurable rules (data/rules/loan-rules.json).
 * Pass `rules` to override; otherwise the JSON file is loaded (hot-reloads on change).
 */
export function evaluateRules(
  app: LoanApplicationInput,
  rules: LoanRules = loadLoanRules()
): RuleCheckResult {
  const reasons: string[] = [];
  const matched: string[] = [];
  const allowed = new Set(
    rules.allowedEmploymentStatuses.map((s) => s.toLowerCase())
  );

  matched.push("Eligibility age");
  if (app.age < rules.age.min || app.age > rules.age.max) {
    reasons.push(
      `Age ${app.age} is outside ${rules.age.min}–${rules.age.max}.`
    );
  }

  matched.push("Employment status");
  if (!allowed.has(app.employmentStatus)) {
    reasons.push(
      `Employment status "${app.employmentStatus}" is not accepted.`
    );
  }

  matched.push("Work tenure");
  const tenureOk = checkTenure(app, rules, allowed);
  if (!tenureOk.ok) {
    reasons.push(tenureOk.reason);
  }

  matched.push("Income floor");
  if (app.monthlyIncome < rules.incomeFloorMonthly) {
    reasons.push(
      `Monthly income ${app.monthlyIncome} is below the ${rules.incomeFloorMonthly} floor.`
    );
  }

  matched.push("Income capacity vs loan amount");
  const band = requiredMonthlyIncome(app.loanAmount, rules);
  if (app.monthlyIncome < band.minMonthly) {
    reasons.push(
      `Monthly income ${app.monthlyIncome} is below ${band.minMonthly} required for loan amount ${app.loanAmount} (${band.label}).`
    );
  }

  matched.push("Maximum loan amount and term");
  if (app.loanAmount > rules.maxLoanAmount) {
    reasons.push(
      `Loan amount ${app.loanAmount} exceeds maximum ${rules.maxLoanAmount}.`
    );
  }
  if (
    app.loanTermMonths < rules.loanTermMonths.min ||
    app.loanTermMonths > rules.loanTermMonths.max
  ) {
    reasons.push(
      `Loan term ${app.loanTermMonths} months is outside ${rules.loanTermMonths.min}–${rules.loanTermMonths.max} months.`
    );
  }

  matched.push("Installment affordability");
  if (app.loanTermMonths > 0) {
    const installment = app.loanAmount / app.loanTermMonths;
    const maxInstallment =
      app.monthlyIncome * rules.maxInstallmentToIncomeRatio;
    if (installment > maxInstallment) {
      reasons.push(
        `Estimated installment ${installment.toFixed(0)} exceeds ${
          rules.maxInstallmentToIncomeRatio * 100
        }% of monthly income (${maxInstallment.toFixed(0)}).`
      );
    }
  }

  matched.push("Credit score bands");
  const { declineBelow, restrictedBand } = rules.creditScore;
  if (app.creditScore < declineBelow) {
    reasons.push(
      `Credit score ${app.creditScore} is below ${declineBelow}.`
    );
  } else if (
    app.creditScore >= restrictedBand.min &&
    app.creditScore <= restrictedBand.max
  ) {
    const dtiStrict =
      app.monthlyIncome > 0
        ? (app.existingDebt + app.loanAmount) / (app.monthlyIncome * 12)
        : Number.POSITIVE_INFINITY;
    if (
      dtiStrict >= restrictedBand.maxDti ||
      app.loanAmount > restrictedBand.maxLoanAmount
    ) {
      reasons.push(
        `Credit score ${app.creditScore} (${restrictedBand.min}–${restrictedBand.max}) requires DTI under ${
          restrictedBand.maxDti * 100
        }% and loan amount at most ${restrictedBand.maxLoanAmount}.`
      );
    }
  }

  matched.push("Debt-to-income (DTI)");
  if (app.monthlyIncome > 0) {
    const dti = (app.existingDebt + app.loanAmount) / (app.monthlyIncome * 12);
    if (dti > rules.maxDti) {
      reasons.push(
        `DTI ${(dti * 100).toFixed(1)}% exceeds the maximum ${
          rules.maxDti * 100
        }%.`
      );
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons:
      reasons.length > 0
        ? reasons
        : ["All deterministic guideline checks passed."],
    matched_rules: matched,
    rulesVersion: rules.version,
  };
}

function requiredMonthlyIncome(
  loanAmount: number,
  rules: LoanRules
): { minMonthly: number; label: string } {
  const bands = [...rules.incomeBands].sort(
    (a, b) => a.maxLoanAmount - b.maxLoanAmount
  );
  const match = bands.find((band) => loanAmount <= band.maxLoanAmount);
  if (match) {
    return { minMonthly: match.minMonthlyIncome, label: match.label };
  }
  const last = bands[bands.length - 1]!;
  return { minMonthly: last.minMonthlyIncome, label: last.label };
}

function checkTenure(
  app: LoanApplicationInput,
  rules: LoanRules,
  allowed: Set<string>
): { ok: boolean; reason: string } {
  const status = app.employmentStatus;
  if (!allowed.has(status)) {
    return { ok: true, reason: "" };
  }

  const requirement = rules.tenure.byEmploymentStatus[status];
  if (!requirement) {
    return {
      ok: false,
      reason: `No tenure rule configured for employment status "${status}".`,
    };
  }

  const needed =
    app.loanAmount > rules.tenure.loanAmountThreshold
      ? requirement.aboveThresholdMonths
      : requirement.atOrBelowThresholdMonths;

  if (app.monthsEmployed < needed) {
    return {
      ok: false,
      reason: `Work tenure ${app.monthsEmployed} months is below ${needed} months required for loan ${app.loanAmount} (${status}).`,
    };
  }

  return { ok: true, reason: "" };
}
