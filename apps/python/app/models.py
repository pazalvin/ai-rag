from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Snake_case in Python, camelCase on the wire (matches the TS API)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def js_num(value: float) -> str:
    """Format a number the way JS template literals do (no trailing `.0`)."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def to_fixed(value: float, digits: int) -> str:
    """JS Number.prototype.toFixed (round half away from zero)."""
    quant = Decimal(1).scaleb(-digits)
    return str(Decimal(repr(value)).quantize(quant, rounding=ROUND_HALF_UP))
