# Source of Truth — Eligibility Decision (Report Note)

## Summary

In this prototype, **the final FIT / NOT FIT decision does not come from the AI or from the policy PDF alone**.

The **source of truth for eligibility** is:

1. **Configurable underwriting rules** (`data/rules/loan-rules.json`)  
2. **Proof-document verification** (when documents are uploaded)

Company guideline documents (`data/guidelines/`, e.g. loan policy Markdown/PDF) support **explanation and policy lookup** (RAG + local LLM). They are **not** what flips the FIT banner.

---

## Final decision formula

```text
FIT  =  rules pass  AND  proof documents pass
```

If either part fails → **NOT FIT**.

The local LLM may give its own opinion on screen. That opinion is **advisory only** and cannot override the result above.

---

## What each source is for

| Source | Is it source of truth for FIT? | Purpose |
|--------|----------------------------------|---------|
| **`loan-rules.json`** | **Yes** | Hard checklist: age, income, tenure, credit, DTI, loan limits, etc. Same inputs → same result. |
| **Proof PDFs** (payslip / bank / COE) | **Yes** (when required) | Confirm documents are capacity-related and match name / income. |
| **Guideline PDF / MD** | **No** | Loaded into a searchable library; relevant paragraphs are retrieved to help the AI **explain**. |
| **Local LLM (Ollama)** | **No** | Comments using retrieved guideline text only. Does not decide FIT. |

---

## Why this design (for the report)

- **Consistency:** Business rules are explicit numbers in JSON, not “whatever the model feels today.”  
- **Explainability:** Policy documents still matter — the system can show which guideline snippets relate to the case.  
- **Control:** Changing a threshold in rules changes the decision; changing only the PDF without updating rules does **not** change FIT.  
- **Safety for a prototype:** Avoids treating generative AI as the underwriter of record.

---

## One paragraph you can paste into a report

> In Guideline Gate, eligibility is determined by a deterministic rules engine and optional proof-document checks. Company guideline files (policy Markdown/PDF) are ingested into a vector store and retrieved to support a local LLM explanation. The LLM is not the source of truth for approval: the FIT / NOT FIT outcome is produced only when underwriting rules pass and required documents verify successfully. Guideline documents and the AI view provide transparency and context, while `loan-rules.json` remains the authoritative checklist for the decision.

---

## Plain-language line for non-technical readers

> The **rules file** is the referee that decides FIT. The **policy PDF** is the rulebook the AI can quote when explaining. The AI is a commentator, not the referee.
