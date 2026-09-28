from app.loan.classify_proof_document import classify_proof_document


def test_classifies_payslip():
    result = classify_proof_document(
        """
        Monthly Payslip / Pay Slip / Payroll
        Employee Name: Jane Doe
        Employer: Acme Inc
        Gross Pay: 45000
        Net Pay: 42000
        Pay Period: June 2026
        YTD Earnings: 250000
        """
    )
    assert result.type == "payslip"
    assert result.related_to_loan_capacity is True
    assert result.confidence > 0
    assert "payslip" in result.matched_keywords or "net pay" in result.matched_keywords


def test_classifies_bank_statement():
    result = classify_proof_document(
        """
        Bank Statement / Account Statement
        Account Number: 123456
        Opening Balance: 10000
        Closing Balance: 20000
        Salary Credit: 45000
        Transaction History
        """
    )
    assert result.type == "bank_statement"
    assert result.related_to_loan_capacity is True


def test_classifies_employment_certificate():
    result = classify_proof_document(
        """
        Certificate of Employment
        This is to certify that Jane Doe is currently employed
        Position: Analyst
        Date Hired: 2024-01-01
        Human Resources Department
        """
    )
    assert result.type == "employment_certificate"
    assert result.related_to_loan_capacity is True


def test_unrelated_text_is_unknown():
    result = classify_proof_document(
        """
        Electric Utility Bill
        Amount Due: 3200
        Meter Reading: 99881
        """
    )
    assert result.type == "unknown"
    assert result.related_to_loan_capacity is False
