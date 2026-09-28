# Test documents catalog

Ready-made PDFs for manual UI testing and automated tests.

Regenerate everything:

```bash
npm run generate:testdata
```

---

## Applications (`testdata/applications/`)

| File | Applicant | Expected (rules) |
|------|-----------|------------------|
| `eligible-jane-doe.pdf` | Jane Doe · income 45k · loan 200k | FIT |
| `eligible-high-income-mark.pdf` | Mark Rivera · income 75k · loan 400k | FIT |
| `ineligible-low-income.pdf` | Low Income Leo · 22k vs 200k loan | NOT FIT (income band) |
| `ineligible-short-tenure.pdf` | Short Tenure Sam · 3 months | NOT FIT (tenure) |
| `ineligible-unemployed.pdf` | Unemployed Uma | NOT FIT (employment) |
| `ineligible-high-dti.pdf` | High DTI Dana | NOT FIT (DTI) |

---

## Proof documents (`testdata/proofs/`)

| File | Type | Expected |
|------|------|----------|
| `payslip-jane-doe.pdf` | Payslip | ACCEPT with Jane |
| `bank-statement-jane-doe.pdf` | Bank statement | ACCEPT with Jane |
| `employment-certificate-jane-doe.pdf` | COE | Related; better with payslip/bank |
| `payslip-mark-rivera.pdf` | Payslip | ACCEPT with Mark |
| `payslip-income-mismatch.pdf` | Payslip | REJECT (income too low vs Jane claim) |
| `payslip-wrong-name.pdf` | Payslip | REJECT (name mismatch vs Jane) |
| `utility-bill-unrelated.pdf` | Utility bill | REJECT (not capacity-related) |
| `grocery-receipt-unrelated.pdf` | Receipt | REJECT (not capacity-related) |

---

## Suggested manual test bundles

### 1) Happy path — FIT

- Application: `eligible-jane-doe.pdf`
- Proof: `payslip-jane-doe.pdf`

```bash
curl -F "application=@testdata/applications/eligible-jane-doe.pdf" \
  -F "proofs=@testdata/proofs/payslip-jane-doe.pdf" \
  http://localhost:3000/api/assess-documents
```

### 2) Happy path with bank statement — FIT

- Application: `eligible-jane-doe.pdf`
- Proof: `bank-statement-jane-doe.pdf`

### 3) High income applicant — FIT

- Application: `eligible-high-income-mark.pdf`
- Proof: `payslip-mark-rivera.pdf`

### 4) Unrelated document — NOT FIT

- Application: `eligible-jane-doe.pdf`
- Proof: `utility-bill-unrelated.pdf`

### 5) Income mismatch — NOT FIT

- Application: `eligible-jane-doe.pdf`
- Proof: `payslip-income-mismatch.pdf`

### 6) Wrong person on payslip — NOT FIT

- Application: `eligible-jane-doe.pdf`
- Proof: `payslip-wrong-name.pdf`

### 7) Rules fail even with good proof — NOT FIT

- Application: `ineligible-low-income.pdf`
- Proof: (optional) any Leo-matching proof — rules alone already fail

### 8) UI

1. Open http://localhost:3000  
2. Use **Assess with documents**  
3. Pick one application + one or more proofs from the tables above  

---

## Regenerate individually

```bash
npm run generate:applicant-pdfs
npm run generate:proof-pdfs
```
