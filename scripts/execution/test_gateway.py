#!/usr/bin/env python3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gateway import Context, Limits, Ticket, evaluate, load_limits


def limits(**changes):
    value = Limits(execution_account="EXECUTION", groups={"theme": ["XYZ", "ABC"]})
    for key, item in changes.items(): setattr(value, key, item)
    return value


def context(**changes):
    value = Context(equity=10_000, snapshot_age_s=10)
    for key, item in changes.items(): setattr(value, key, item)
    return value


def buy(**changes):
    value = Ticket(account="EXECUTION", symbol="XYZ", side="buy", quantity=10,
                   limit_price=50, stop_price=45, idempotency_key="ticket-1",
                   correlation_group="theme")
    for key, item in changes.items(): setattr(value, key, item)
    return value


class GatewayTests(unittest.TestCase):
    def test_valid_ticket_passes_but_remains_validate_only(self):
        decision = evaluate(buy(), context(), limits())
        self.assertTrue(decision.allowed, decision.reasons)
        self.assertTrue(decision.to_dict()["validate_only"])

    def test_wrong_account_and_option_fail(self):
        self.assertFalse(evaluate(buy(account="OTHER"), context(), limits()).allowed)
        self.assertFalse(evaluate(buy(asset_class="option"), context(), limits()).allowed)
        self.assertFalse(evaluate(buy(order_type="market"), context(), limits()).allowed)

    def test_ticket_shape_fails_closed(self):
        self.assertFalse(evaluate(buy(quantity=0), context(), limits()).allowed)
        self.assertFalse(evaluate(buy(quantity=-1), context(), limits()).allowed)
        self.assertFalse(evaluate(buy(symbol="xyz"), context(), limits()).allowed)

    def test_buy_requires_stop_below_entry(self):
        self.assertFalse(evaluate(buy(stop_price=None), context(), limits()).allowed)
        self.assertFalse(evaluate(buy(stop_price=55), context(), limits()).allowed)

    def test_risk_notional_and_position_caps_fail_closed(self):
        self.assertFalse(evaluate(buy(quantity=30), context(), limits(risk_per_trade_pct=1)).allowed)
        self.assertFalse(evaluate(buy(quantity=50), context(), limits(max_trade_notional_pct=20)).allowed)
        ctx = context(positions={"XYZ": {"market_value": 2400}})
        self.assertFalse(evaluate(buy(), ctx, limits(max_position_pct=25)).allowed)

    def test_group_daily_loss_idempotency_and_freshness_fail_closed(self):
        ctx = context(positions={"ABC": {"market_value": 5900}})
        self.assertFalse(evaluate(buy(), ctx, limits(max_group_pct=60)).allowed)
        self.assertFalse(evaluate(buy(), context(daily_realized_pnl=-600), limits()).allowed)
        self.assertFalse(evaluate(buy(), context(seen_idempotency_keys=["ticket-1"]), limits()).allowed)
        self.assertFalse(evaluate(buy(), context(snapshot_age_s=901), limits()).allowed)

    def test_allowlist_and_missing_account_fail_closed(self):
        self.assertFalse(evaluate(buy(), context(), limits(allowed_symbols=["ABC"])).allowed)
        self.assertFalse(evaluate(buy(), context(), limits(execution_account="")).allowed)

    def test_sell_is_risk_reducing_but_still_needs_price_and_identity(self):
        ticket = buy(side="sell", stop_price=None, idempotency_key="sell-1")
        held = context(positions={"XYZ": {"quantity": 20, "market_value": 1000}})
        self.assertTrue(evaluate(ticket, held, limits()).allowed)
        self.assertFalse(evaluate(ticket, context(), limits()).allowed)
        self.assertFalse(evaluate(buy(side="sell", quantity=21, stop_price=None,
                                      idempotency_key="sell-2"), held, limits()).allowed)
        self.assertFalse(evaluate(ticket, context(), limits(execution_account="")).allowed)

    def test_risk_reducing_sell_is_not_blocked_by_entry_or_loss_caps(self):
        ticket = buy(side="sell", quantity=100, stop_price=None, idempotency_key="sell-all")
        held = context(
            positions={"XYZ": {"quantity": 100, "market_value": 5000}},
            daily_realized_pnl=-600,
        )
        self.assertTrue(evaluate(ticket, held, limits()).allowed)

    def test_example_account_placeholder_is_not_tradable(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp) / "config.toml"
            config.write_text(
                '[broker.robinhood]\naccount_number = "YOUR_ACCOUNT_NUMBER"\n',
                encoding="utf-8",
            )
            configured = load_limits(str(config))
            self.assertFalse(evaluate(buy(account="YOUR_ACCOUNT_NUMBER"), context(), configured).allowed)


if __name__ == "__main__": unittest.main()
