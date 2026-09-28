# Guideline Gate — Explaining the Prototype (Non-Technical)

Use this when you talk to managers or colleagues who are **not** engineers.  
Keep it simple. Focus on **what it does** and **why it matters**, not code.

---

## One sentence

**I built a demo that checks if a loan applicant is FIT or NOT FIT using company rules, uploaded documents, and a local AI that explains the result.**

---

## What problem it solves

Today, someone may manually read guidelines and papers to decide if a person qualifies for a loan.

This prototype shows how that can be **assisted** by software:

- Apply the same rules every time  
- Check that proof documents look relevant and match the applicant  
- Pull the right parts of company policy to explain the decision  

It is a **prototype** — for demo and discussion, not live banking customers yet.

---

## How to explain it in 60 seconds

> “Imagine a librarian and a checklist.
>
> 1. We load our company loan policy into a searchable library.  
> 2. When an applicant comes in, we fill a form or upload their application and payslip.  
> 3. A checklist of rules runs (age, income, credit, etc.).  
> 4. We check the papers match the person.  
> 5. The system finds the most relevant policy paragraphs and a small local AI explains the result.  
> 6. The final FIT / NOT FIT comes from the checklist and the documents — not from the AI guessing.”

---

## The journey (story form)

### 1. We teach the system our policy

We take company guideline files (like a PDF or Word-style policy) and break them into small readable pieces.

Think of a thick policy book → cut into **index cards**.  
Each card is stored so we can find it later by meaning, not only by keyword.

*(Technical name: “chunking” and “embedding” — you don’t need to say that unless asked.)*

### 2. Someone applies

Two ways in the demo:

- **Quick form** — type age, income, loan amount, etc.  
- **With documents** — upload an application PDF + proof (payslip / bank statement / employment certificate)

### 3. Two gates decide FIT (the important part)

**Gate 1 — Rules (the checklist)**  
Same thresholds every time: age range, income vs loan size, work history, credit, debt, etc.  
Editable in a config file so business can change numbers without rewriting the whole app.

**Gate 2 — Proof documents (the papers)**  
- Is this a payslip / bank statement / employment cert (not a random bill)?  
- Does the name match?  
- Does the income roughly match what they claimed?

```text
FIT  =  checklist passes  AND  papers pass
```

If either fails → **NOT FIT**.

### 4. The AI’s job (explanation only)

The system finds the policy “index cards” most related to this applicant, then a **local** AI (runs on our machine via Ollama) writes a short explanation.

Important talking point:

> **The AI does not make the final FIT decision.**  
> Rules + documents do. The AI is like a junior analyst commenting on the policy — helpful, not the boss.

---

## What people see on screen

1. Green or red banner: **FIT** or **NOT FIT**  
2. Reasons in plain language  
3. Whether each proof document was accepted  
4. Related policy snippets (with a “how related” score)  
5. Optional AI comment  

---

## How to demo in 5 minutes (for your audience)

1. Open the app in a browser (`http://localhost:3000` when running).  
2. **Form demo:** leave sample Jane Doe → click rules check → show FIT.  
3. **Document demo:**  
   - Application = `eligible-jane-doe.pdf`  
   - Proof = `payslip-jane-doe.pdf`  
   - Show FIT again.  
4. Optional fail demo: use a utility bill as proof → show NOT FIT (wrong document type).  

Remind them: **don’t put a payslip in the Application slot** — application form goes first, proofs second.

---

## Tech stack (say this simply)

If someone asks “what did you build it with?”:

| Piece | Plain English | What we used |
|-------|----------------|--------------|
| Website | The screens people click | Next.js + shadcn |
| Backend | The brain behind the screens | Hono (TypeScript) |
| Database | Where policy pieces are stored | PostgreSQL + pgvector |
| AI models | Local models (no cloud required for the demo) | Ollama: small Llama + embedding model |
| Rules | Business thresholds | JSON config file |
| Policy files | Company guidelines | Folder of MD/PDF docs |

One line for executives:

> “A modern web app, a database that can search by meaning, and local AI — all wired to our loan rules.”

---

## Questions they might ask (and short answers)

**Is the AI deciding loans?**  
No. Rules and document checks decide. AI explains.

**Is customer data sent to ChatGPT?**  
Not in this prototype. Models run **locally** with Ollama.

**Can we change the rules?**  
Yes — update the rules config (age, income bands, etc.) without rebuilding the whole product.

**Is this production-ready?**  
No. It’s a **demo** to show the idea. Real banking needs security, audit, compliance, etc.

**What happens if policy changes?**  
Update the guideline files and reload them into the library (re-ingest).

**Why not only use AI?**  
AI alone can be inconsistent. A checklist keeps decisions **repeatable and explainable**.

---

## Talking points (copy for a meeting)

- Built a **loan eligibility prototype**: FIT / NOT FIT.  
- Combines **rules**, **document verification**, and **policy search + local AI explanation**.  
- Final decision is **rules + documents**; AI is advisory.  
- Stack: web UI, TypeScript API, Postgres, local Ollama models.  
- Ready for a short live demo with sample applicants.  
- Next steps (if they ask): harden for production, real auth, audit trail, integrate real policy.

---

## Closing line

> “This prototype shows we can automate consistent eligibility checks, verify supporting documents, and use our own guidelines with local AI — without letting the AI silently override business rules.”
