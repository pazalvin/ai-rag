# Note for my manager — Guideline Gate

Hi,

I built a small **loan eligibility prototype** called **Guideline Gate**.

### What it does
It checks if a loan applicant is a **FIT** or **NOT FIT** based on company rules.

A user can:
- Fill in applicant details on a form, **or**
- Upload an application PDF plus proof documents (payslip / bank statement / employment certificate)

The system then:
1. Checks the numbers against our rules (age, income, work history, credit, debt, etc.)
2. Checks that the proof documents match the applicant (name and income)
3. Shows a clear **FIT / NOT FIT** result, with reasons

There is also a small local AI helper that can **explain** the result using company guideline text. The AI does **not** make the final decision — the rules and documents do.

### Why I built it
To show a working demo of:
- Automated eligibility checks
- Document verification (not just a form)
- Using company guidelines in a practical way

### How to try it
- Open the app in the browser (when running): `http://localhost:3000`
- Sample files are included so you can test FIT and NOT FIT cases quickly

### Tech stack (simple)
| Layer | What we used |
|-------|----------------|
| **UI** | Next.js + shadcn (React) |
| **API** | Hono (TypeScript) |
| **Database** | PostgreSQL + pgvector (for similarity search) |
| **AI / models** | Ollama locally — `llama3.2:1b` (chat) + `nomic-embed-text` (embeddings) |
| **Rules** | Editable JSON config (`loan-rules.json`) |
| **Run** | Docker Compose (Postgres, Ollama, API, UI) or local `npm run dev:all` |

In short: a modern TypeScript web app, local database, and local AI — no cloud LLM required for the demo.

### Important
This is a **prototype / demo**, not a finished banking product. It is meant for internal review and discussion, not live customer use yet.

Happy to walk you through a 5-minute demo anytime.

Thanks.
