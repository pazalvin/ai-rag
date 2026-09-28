import json
import threading
from dataclasses import dataclass

from pydantic import ValidationError

from app.config import config
from app.loan.rules_schema import LoanRules


@dataclass
class _Cache:
    mtime_ns: int
    rules: LoanRules


_cache: _Cache | None = None
_lock = threading.Lock()


def format_validation_error(err: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(p) for p in issue['loc'])}: {issue['msg']}" for issue in err.errors()
    )


def load_loan_rules(force: bool = False) -> LoanRules:
    """
    Load underwriting rules from data/rules/loan-rules.json.
    Reloads automatically when the file changes on disk.
    """
    global _cache
    path = config.loan_rules_path
    if not path.exists():
        raise FileNotFoundError(f"Loan rules file not found: {path}")

    mtime_ns = path.stat().st_mtime_ns
    with _lock:
        if not force and _cache and _cache.mtime_ns == mtime_ns:
            return _cache.rules

        raw = json.loads(path.read_text(encoding="utf-8"))
        try:
            rules = LoanRules.model_validate(raw)
        except ValidationError as err:
            raise ValueError(f"Invalid loan rules config: {format_validation_error(err)}") from err

        _cache = _Cache(mtime_ns=mtime_ns, rules=rules)
        return rules


def reload_loan_rules() -> LoanRules:
    global _cache
    with _lock:
        _cache = None
    return load_loan_rules(force=True)


def save_loan_rules(rules: LoanRules) -> LoanRules:
    payload = rules.model_dump(by_alias=True, exclude_none=True)
    config.loan_rules_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return reload_loan_rules()
