# Guideline Gate — Prototype Share Guide

> **For colleagues** · Copy this page into Notion as-is.  
> Product name: **Guideline Gate** · Loan eligibility check (rules + proof documents + local AI)

---

## 1. What this is (30 seconds)

**Guideline Gate** is a prototype that decides if a loan applicant is **FIT** or **NOT FIT** for a loan based on company guidelines.

Someone submits:

1. An **application** (web form or PDF)
2. **Proof documents** (payslip, bank statement, and/or employment certificate)

The system then:

1. Checks **underwriting rules** (age, income, tenure, credit, DTI, etc.)
2. Verifies that **proofs** look real and match name / income
3. Finds related **policy text** (RAG + cosine similarity)
4. Optionally asks a **local AI** (Llama via Ollama) to explain — the AI does **not** make the final FIT decision

**Stack:** Next.js + shadcn UI · Hono API · PostgreSQL/pgvector · Ollama (local LLM)

---

## 2. How FIT / NOT FIT is decided

Think of it as a **checklist**, not a chat with AI.

### Final rule

```
FIT  =  rules pass  AND  proof documents pass
```

If either part fails → **NOT FIT**.

| Gate | What it checks | Can AI override? |
|------|----------------|------------------|
| **1 — Rules** | Age, employment, tenure, income vs loan size, installment, credit, DTI | No |
| **2 — Proof docs** | Doc type (payslip/bank/COE), name match, income within ~15% | No |
| **AI RAG view** | Explanation from retrieved guidelines | Advisory only |

### Tiny examples

| Situation | Result |
|-----------|--------|
| Numbers OK + matching payslip | **FIT** |
| Numbers OK, but payslip has a different name | **NOT FIT** |
| Matching payslip, but income too low for the loan | **NOT FIT** |
| Rules + docs pass, AI says “maybe not” | Still **FIT** |

---

## 3. How to run it (local)

### What must be running

| Piece | Port | Role |
|-------|------|------|
| Postgres (pgvector) | 5432 | Data + embeddings |
| Ollama | 11434 | Embeddings + Llama |
| Hono API | **3001** | Eligibility logic |
| Next.js UI | **3000** | Screens colleagues use |

### Fast path

```bash
# From the project root
cp .env.example .env
npm install
cd web && npm install && cd ..

npm run deps:up    # starts Postgres + Ollama, pulls models
npm run dev:all    # starts API (:3001) + UI (:3000)
```

Then open:

- **App:** http://localhost:3000  
- **In-app demo docs + GIF:** http://localhost:3000/docs  
- **API health:** http://localhost:3001/api/health  

### Full Docker (everything in containers)

```bash
docker compose up --build
```

Same URLs as above.

> A rules check can take **several seconds** while Ollama embeds text and replies. That’s normal.

---

## 4. How to demo it in 5 minutes

### Option A — Quick form (rules only)

1. Open http://localhost:3000  
2. Stay on **Quick form check**  
3. Leave the sample **Jane Doe** values  
4. Click **Rules-only check**  
5. Read the green/red banner + reasons  

### Option B — Documents (full path: rules + proofs)

1. Open http://localhost:3000 → tab **Assess with documents**  
2. **Application PDF** ← `testdata/applications/eligible-jane-doe.pdf`  
3. **Proof documents** ← `testdata/proofs/payslip-jane-doe.pdf`  
4. Click **Verify docs & check fit**  
5. Expect **FIT**

### Important: don’t swap the files

| Upload field | Use this | Don’t use |
|--------------|----------|-----------|
| Application PDF | `testdata/applications/*.pdf` | Payslips / bank statements |
| Proof documents | `testdata/proofs/*.pdf` | Application forms |

If you put a payslip in the Application field, parsing will fail (missing Age, Loan Amount, etc.).

---

## 5. Ready-made test cases to try together

### Happy paths (expect FIT)

| Application | Proof |
|-------------|--------|
| `eligible-jane-doe.pdf` | `payslip-jane-doe.pdf` |
| `eligible-jane-doe.pdf` | `bank-statement-jane-doe.pdf` |
| `eligible-high-income-mark.pdf` | `payslip-mark-rivera.pdf` |

### Fail paths (expect NOT FIT)

| Application | Proof | Why |
|-------------|--------|-----|
| `eligible-jane-doe.pdf` | `utility-bill-unrelated.pdf` | Not capacity-related |
| `eligible-jane-doe.pdf` | `payslip-income-mismatch.pdf` | Income doesn’t match |
| `eligible-jane-doe.pdf` | `payslip-wrong-name.pdf` | Wrong person on payslip |
| `ineligible-low-income.pdf` | matching-style proof | Income band fails |
| `ineligible-short-tenure.pdf` | any | Tenure too short |
| `ineligible-unemployed.pdf` | any | Employment status |
| `ineligible-high-dti.pdf` | any | DTI too high |

Regenerate samples anytime:

```bash
npm run generate:testdata
```

---

## 6. What you see on the results screen

1. **Banner** — FIT / NOT FIT (final decision)  
2. **Document verification** — each proof accepted/rejected + issues  
3. **Fit decision (rules + docs)** — human-readable reasons  
4. **Matched rules** — which rule checks ran  
5. **AI RAG view** — optional opinion (does not override the banner)  
6. **Retrieved guidelines** — policy snippets + similarity scores  

---

## 7. Architecture (for engineers)

```
Browser
  → Next.js UI (:3000)
      → proxies /api/* 
  → Hono API (:3001)
      → Rule engine (data/rules/loan-rules.json)
      → Proof verification (classify + name/income match)
      → RAG: embed query → Postgres pgvector cosine search
      → Ollama Llama (explanation only)
```

| Concern | Location |
|---------|----------|
| UI | `web/` |
| API / loan logic | `src/loan/`, `src/routes/` |
| Editable rules | `data/rules/loan-rules.json` |
| Policy docs for RAG | `data/guidelines/` |
| Sample PDFs | `testdata/` |

### Cosine similarity (one line)

Text → embedding vector → “how similar is this guideline chunk to the applicant?” → top chunks shown and passed to the LLM.

---

## 8. Configurable rules (no code change)

Edit `data/rules/loan-rules.json` to change thresholds (age range, income bands, max DTI, credit bands, document verification settings).

The file hot-reloads when saved. Keep guideline docs in `data/guidelines/` in sync when you change thresholds.

---

## 9. FAQ / troubleshooting

**Form fails / “API not working”**  
Check http://localhost:3001/api/health — the UI alone is not enough; API + Postgres + Ollama must be up. Use `npm run deps:up` then `npm run dev:all`.

**“Could not parse application PDF fields”**  
You likely uploaded a payslip as the Application. Use `testdata/applications/…` there.

**Slow response**  
First LLM calls can take 10–20+ seconds. Wait for the banner.

**Docker disk full / Postgres “no space left”**  
Clean Docker: `docker system prune -af` (and optionally unused volumes), then retry.

**Is this production banking software?**  
No — it’s a **prototype / demo**. No KYC, auth, audit compliance, or multi-tenant hardening yet.

---

## 10. Talking points for stakeholders

- **Deterministic underwriting first** — rules + docs decide FIT; AI explains.  
- **Runs locally** — data and models can stay on your machine (Ollama).  
- **Configurable** — business can tweak JSON rules without redeploying logic.  
- **Document-aware** — rejects unrelated bills and mismatched name/income.  
- **Sellable prototype range (rough)** — code handoff often mid four-figures; with setup/customization higher; real lender pilots are scoped projects.

---

## 11. Links inside the repo

| Resource | Path / URL |
|----------|------------|
| Main README | `README.md` |
| In-app demo page | http://localhost:3000/docs |
| Demo GIF | `web/public/demo.gif` |
| Test PDF catalog | `testdata/README.md` |
| Rules config | `data/rules/loan-rules.json` |

---

*Prototype: Guideline Gate · Share internally · Not a production compliance product.*
