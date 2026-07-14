#!/usr/bin/env python3
"""Deterministic, validate-only execution gateway.

The pure ``evaluate`` function checks a proposed equity ticket against explicit
account, risk, concentration, idempotency, and freshness limits. This module has
no broker client and cannot place an order. The CLI only prints a decision and
records rejected tickets in the private operational issue log.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))


@dataclass
class Ticket:
    account: str
    symbol: str
    side: str
    quantity: float
    order_type: str = "limit"
    limit_price: float | None = None
    stop_price: float | None = None
    asset_class: str = "equity"
    idempotency_key: str | None = None
    correlation_group: str | None = None


@dataclass
class Context:
    equity: float
    # symbol -> {"quantity": float, "market_value": float}
    positions: dict = field(default_factory=dict)
    daily_realized_pnl: float = 0.0
    snapshot_age_s: float = 0.0
    seen_idempotency_keys: list = field(default_factory=list)


@dataclass
class Limits:
    execution_account: str
    allowed_symbols: list = field(default_factory=list)
    risk_per_trade_pct: float = 1.0
    max_trade_notional_pct: float = 20.0
    max_position_pct: float = 25.0
    max_group_pct: float = 60.0
    groups: dict = field(default_factory=dict)
    daily_loss_limit_pct: float = 5.0
    max_snapshot_age_s: float = 900.0


@dataclass
class Check:
    name: str
    ok: bool
    detail: str


@dataclass
class Decision:
    allowed: bool
    ticket_id: str
    checks: list

    @property
    def reasons(self) -> list:
        return [item["detail"] for item in self.checks if not item["ok"]]

    def to_dict(self) -> dict:
        value = asdict(self)
        value["reasons"] = self.reasons
        value["validate_only"] = True
        return value


def result(name: str, ok: bool, detail: str) -> Check:
    return Check(name, bool(ok), detail)


def risk_increasing(ticket: Ticket) -> bool:
    return ticket.side == "buy"


def check_ticket_shape(ticket: Ticket, context: Context, limits: Limits) -> Check:
    account_ok = bool(ticket.account.strip())
    symbol_ok = bool(ticket.symbol.strip()) and ticket.symbol == ticket.symbol.upper()
    quantity_ok = ticket.quantity > 0
    ok = account_ok and symbol_ok and quantity_ok
    return result(
        "ticket_shape",
        ok,
        "positive quantity with normalized symbol and account"
        if ok
        else "ticket requires an account, an uppercase symbol, and a positive quantity",
    )


def check_account(ticket: Ticket, context: Context, limits: Limits) -> Check:
    configured = limits.execution_account.strip()
    usable = bool(configured) and "YOUR_" not in configured.upper()
    ok = usable and ticket.account == configured
    return result(
        "account_allowlist",
        ok,
        "configured execution account"
        if ok
        else "account is not the configured execution account, or execution scope is not configured",
    )


def check_instrument(ticket: Ticket, context: Context, limits: Limits) -> Check:
    ok = (
        ticket.asset_class == "equity"
        and ticket.side in {"buy", "sell"}
        and ticket.order_type == "limit"
    )
    return result(
        "instrument_side_and_type",
        ok,
        "equity limit buy/sell"
        if ok
        else "only equity limit buy/sell tickets are supported in this phase",
    )


def check_symbol(ticket: Ticket, context: Context, limits: Limits) -> Check:
    ok = not limits.allowed_symbols or ticket.symbol in limits.allowed_symbols
    return result("symbol_allowlist", ok, "symbol permitted" if ok else "symbol is not on the configured allowlist")


def check_risk(ticket: Ticket, context: Context, limits: Limits) -> Check:
    if not risk_increasing(ticket):
        return result("risk_first_sizing", True, "risk-reducing ticket")
    if not ticket.limit_price or ticket.limit_price <= 0:
        return result("risk_first_sizing", False, "buy ticket needs a positive limit price")
    if not ticket.stop_price or ticket.stop_price <= 0 or ticket.stop_price >= ticket.limit_price:
        return result("risk_first_sizing", False, "buy ticket needs a positive stop below entry")
    loss = ticket.quantity * (ticket.limit_price - ticket.stop_price)
    cap = limits.risk_per_trade_pct / 100 * context.equity
    return result("risk_first_sizing", loss <= cap + 1e-9, f"max loss {loss:.2f}; cap {cap:.2f}")


def check_position_inventory(ticket: Ticket, context: Context, limits: Limits) -> Check:
    if ticket.side != "sell":
        return result("position_inventory", True, "not a sell ticket")
    held = float(context.positions.get(ticket.symbol, {}).get("quantity", 0))
    ok = held > 0 and ticket.quantity <= held + 1e-9
    return result(
        "position_inventory",
        ok,
        f"sell quantity {ticket.quantity:g}; held quantity {held:g}",
    )


def check_notional(ticket: Ticket, context: Context, limits: Limits) -> Check:
    if not risk_increasing(ticket):
        return result("trade_notional_cap", True, "risk-reducing ticket")
    if not ticket.limit_price or ticket.limit_price <= 0:
        return result("trade_notional_cap", False, "ticket needs a positive price")
    notional = ticket.quantity * ticket.limit_price
    cap = limits.max_trade_notional_pct / 100 * context.equity
    return result("trade_notional_cap", notional <= cap + 1e-9, f"notional {notional:.2f}; cap {cap:.2f}")


def check_concentration(ticket: Ticket, context: Context, limits: Limits) -> Check:
    if not risk_increasing(ticket):
        return result("concentration_cap", True, "risk-reducing ticket")
    current = float(context.positions.get(ticket.symbol, {}).get("market_value", 0))
    post = current + ticket.quantity * float(ticket.limit_price or 0)
    weight = post / context.equity * 100 if context.equity else float("inf")
    return result("concentration_cap", weight <= limits.max_position_pct + 1e-9, f"post-trade weight {weight:.1f}%")


def check_group(ticket: Ticket, context: Context, limits: Limits) -> Check:
    if not risk_increasing(ticket) or not ticket.correlation_group:
        return result("correlated_group_cap", True, "no risk-increasing group constraint")
    symbols = set(limits.groups.get(ticket.correlation_group, [])) | {ticket.symbol}
    current = sum(float(context.positions.get(symbol, {}).get("market_value", 0)) for symbol in symbols)
    post = current + ticket.quantity * float(ticket.limit_price or 0)
    weight = post / context.equity * 100 if context.equity else float("inf")
    return result("correlated_group_cap", weight <= limits.max_group_pct + 1e-9, f"post-trade group weight {weight:.1f}%")


def check_daily_loss(ticket: Ticket, context: Context, limits: Limits) -> Check:
    if not risk_increasing(ticket):
        return result("daily_loss_breaker", True, "risk-reducing ticket")
    floor = -abs(limits.daily_loss_limit_pct / 100 * context.equity)
    return result("daily_loss_breaker", context.daily_realized_pnl > floor, f"realized P&L {context.daily_realized_pnl:.2f}; breaker {floor:.2f}")


def check_idempotency(ticket: Ticket, context: Context, limits: Limits) -> Check:
    ok = bool(ticket.idempotency_key) and ticket.idempotency_key not in set(context.seen_idempotency_keys)
    return result("idempotency", ok, "new idempotency key" if ok else "missing or duplicate idempotency key")


def check_freshness(ticket: Ticket, context: Context, limits: Limits) -> Check:
    ok = 0 <= context.snapshot_age_s <= limits.max_snapshot_age_s
    return result("snapshot_freshness", ok, f"snapshot age {context.snapshot_age_s:.0f}s")


RULES = (
    check_ticket_shape,
    check_account,
    check_instrument,
    check_symbol,
    check_risk,
    check_position_inventory,
    check_notional,
    check_concentration,
    check_group,
    check_daily_loss,
    check_idempotency,
    check_freshness,
)


def evaluate(ticket: Ticket, context: Context, limits: Limits) -> Decision:
    checks = [rule(ticket, context, limits) for rule in RULES]
    ticket_id = ticket.idempotency_key or f"{ticket.side}:{ticket.symbol}:{ticket.quantity}"
    return Decision(all(item.ok for item in checks), ticket_id, [asdict(item) for item in checks])


def load_limits(path: str | None = None) -> Limits:
    import tomllib
    root = Path(__file__).resolve().parents[2]
    selected = root / (path or "config.local.toml")
    if not selected.exists() and path is None:
        selected = root / "config.example.toml"
    with selected.open("rb") as handle:
        config = tomllib.load(handle)
    account = str(config.get("broker", {}).get("robinhood", {}).get("account_number", ""))
    risk = config.get("risk", {})
    defaults = Limits(execution_account=account)
    return Limits(
        execution_account=account,
        allowed_symbols=list(risk.get("allowed_symbols", [])),
        risk_per_trade_pct=float(risk.get("risk_per_trade_pct", defaults.risk_per_trade_pct)),
        max_trade_notional_pct=float(risk.get("max_trade_notional_pct", defaults.max_trade_notional_pct)),
        max_position_pct=float(risk.get("max_position_pct", defaults.max_position_pct)),
        max_group_pct=float(risk.get("max_group_pct", defaults.max_group_pct)),
        groups=dict(risk.get("groups", {})),
        daily_loss_limit_pct=float(risk.get("daily_loss_limit_pct", defaults.daily_loss_limit_pct)),
        max_snapshot_age_s=float(risk.get("max_snapshot_age_s", defaults.max_snapshot_age_s)),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ticket", required=True, help="ticket JSON")
    parser.add_argument("--context", required=True, help="live context JSON")
    parser.add_argument("--config")
    args = parser.parse_args(argv)
    ticket = Ticket(**json.loads(args.ticket))
    decision = evaluate(ticket, Context(**json.loads(args.context)), load_limits(args.config))
    if not decision.allowed:
        try:
            import issue_log
            issue_log.record(
                severity="warn",
                category="gateway-reject",
                source="execution-gateway",
                symbol=ticket.symbol,
                summary=f"blocked {ticket.side} {ticket.symbol}",
                context={"ticket_id": decision.ticket_id, "reasons": decision.reasons},
                linked=decision.ticket_id,
            )
        except Exception:
            pass
    print(json.dumps(decision.to_dict(), indent=2))
    return 0 if decision.allowed else 2


if __name__ == "__main__":
    try:
        import desk_log

        raise SystemExit(desk_log.run(main, component="execution-gateway"))
    except ImportError:
        raise SystemExit(main())
