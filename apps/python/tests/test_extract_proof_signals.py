from app.loan.extract_proof_signals import extract_proof_signals


def test_payslip_net_pay_and_name():
    signals = extract_proof_signals(
        """
        Payslip
        Employee Name: Jane Doe
        Employer: Acme Manufacturing Inc.
        Net Pay: 45000
        Gross Pay: 48000
        Basic Salary: 45000
        """,
        "payslip",
    )
    assert signals.employee_or_account_name == "Jane Doe"
    assert signals.monthly_income_evidence == 45000
    assert 45000 in signals.amounts_found


def test_bank_statement_salary_credit():
    signals = extract_proof_signals(
        """
        Bank Statement
        Account Name: Jane Doe
        Salary Credit: 45000
        Closing Balance: 90000
        """,
        "bank_statement",
    )
    assert signals.employee_or_account_name == "Jane Doe"
    assert signals.monthly_income_evidence == 45000


def test_employment_certificate_monthly_salary():
    signals = extract_proof_signals(
        """
        Certificate of Employment
        Employee Name: Jane Doe
        Monthly Salary: 45000
        Currently employed as Analyst
        """,
        "employment_certificate",
    )
    assert signals.monthly_income_evidence == 45000
