from fastapi import APIRouter

from app.config import config
from app.loan.load_rules import load_loan_rules, reload_loan_rules, save_loan_rules
from app.loan.rules_schema import LoanRules
from app.routes.errors import error_response

router = APIRouter()


def _dump(rules: LoanRules) -> dict:
    return rules.model_dump(mode="json", by_alias=True, exclude_none=True)


@router.get("/rules")
def get_rules():
    try:
        return {"path": str(config.loan_rules_path), "rules": _dump(load_loan_rules())}
    except Exception as err:
        return error_response(500, "Failed to load rules", str(err))


@router.post("/rules/reload")
def reload_rules():
    try:
        rules = reload_loan_rules()
        return {"reloaded": True, "version": rules.version, "path": str(config.loan_rules_path)}
    except Exception as err:
        return error_response(500, "Failed to reload rules", str(err))


@router.put("/rules")
def put_rules(rules: LoanRules):
    try:
        loaded = save_loan_rules(rules)
        return {
            "saved": True,
            "version": loaded.version,
            "path": str(config.loan_rules_path),
            "rules": _dump(loaded),
        }
    except Exception as err:
        return error_response(500, "Failed to save rules", str(err))
