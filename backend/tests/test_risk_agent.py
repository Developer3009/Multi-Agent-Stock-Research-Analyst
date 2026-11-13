"""Tests for the Risk Analysis Agent."""
import pytest
import numpy as np
import pandas as pd
from app.agents.state import ResearchState


def _make_full_state(
    ticker="RELIANCE",
    market="NSE",
    fundamental_result=None,
    technical_result=None,
    news_result=None,
) -> ResearchState:
    return ResearchState(
        task_id="test-risk-001",
        ticker=ticker,
        market=market,
        yf_ticker=f"{ticker}.NS",
        period="1y",
        fundamental_result=fundamental_result,
        technical_result=technical_result,
        news_result=news_result,
        risk_result=None,
        fundamental_status="completed" if fundamental_result else "pending",
        technical_status="completed" if technical_result else "pending",
        news_status="completed" if news_result else "pending",
        risk_status="pending",
        sources=[],
        conflicts=[],
        report_content=None,
        report_summary=None,
        report_limitations=None,
        report_status="pending",
        errors=[],
    )


# ── Helper function unit tests ───────────────────────────────────────────────

def test_max_drawdown_known_value():
    """Max drawdown calculation against manually computed value."""
    from app.agents.risk import _max_drawdown

    # Price goes 100 -> 150 -> 75  =>  drawdown = (75 - 150) / 150 = -50%
    close = pd.Series([100.0, 120.0, 150.0, 130.0, 100.0, 75.0])
    mdd = _max_drawdown(close)
    assert mdd is not None
    assert abs(mdd - (-50.0)) < 1.0, f"Expected ~-50%, got {mdd}"


def test_max_drawdown_monotone_increasing():
    """No drawdown in a monotonically increasing series."""
    from app.agents.risk import _max_drawdown

    close = pd.Series([100.0, 110.0, 120.0, 130.0, 140.0])
    mdd = _max_drawdown(close)
    assert mdd is not None
    assert mdd >= -1.0, f"Drawdown in uptrend should be near 0, got {mdd}"


def test_max_drawdown_single_element():
    """Single element series should return None."""
    from app.agents.risk import _max_drawdown

    close = pd.Series([100.0])
    mdd = _max_drawdown(close)
    assert mdd is None


def test_conflict_detection_bullish_negative_margin():
    """Conflict: bullish tech signal + negative net margin."""
    from app.agents.risk import _detect_conflicts

    state = _make_full_state(
        fundamental_result={
            "status": "completed",
            "profitability": {"net_margin": -5.0},
            "valuation": {"pe_ratio": 25.0},
        },
        technical_result={
            "status": "completed",
            "trend": "Bullish",
            "indicators": {"rsi_14": 55.0},
        },
        news_result={
            "status": "completed",
            "overall_sentiment": "positive",
        },
    )
    conflicts = _detect_conflicts(state)
    assert any("negative" in c.lower() or "net profit" in c.lower() for c in conflicts), \
        f"Expected conflict about negative margin, got: {conflicts}"


def test_conflict_detection_overbought_high_pe():
    """Conflict: RSI > 70 AND P/E > 50."""
    from app.agents.risk import _detect_conflicts

    state = _make_full_state(
        fundamental_result={
            "status": "completed",
            "profitability": {"net_margin": 15.0},
            "valuation": {"pe_ratio": 80.0},
        },
        technical_result={
            "status": "completed",
            "trend": "Bullish",
            "indicators": {"rsi_14": 78.0},
        },
    )
    conflicts = _detect_conflicts(state)
    assert any("overbought" in c.lower() or "RSI" in c for c in conflicts), \
        f"Expected RSI/P/E conflict, got: {conflicts}"


def test_conflict_detection_no_conflict():
    """No conflicts when signals are consistent."""
    from app.agents.risk import _detect_conflicts

    state = _make_full_state(
        fundamental_result={
            "status": "completed",
            "profitability": {"net_margin": 20.0},
            "valuation": {"pe_ratio": 25.0},
        },
        technical_result={
            "status": "completed",
            "trend": "Bullish",
            "indicators": {"rsi_14": 55.0},
        },
        news_result={
            "status": "completed",
            "overall_sentiment": "positive",
        },
    )
    conflicts = _detect_conflicts(state)
    assert len(conflicts) == 0, f"Expected no conflicts, got: {conflicts}"


def test_conflict_detection_bullish_tech_negative_news():
    """Conflict: bullish trend + negative news sentiment."""
    from app.agents.risk import _detect_conflicts

    state = _make_full_state(
        technical_result={
            "status": "completed",
            "trend": "Bullish",
            "indicators": {"rsi_14": 55.0},
        },
        news_result={
            "status": "completed",
            "overall_sentiment": "negative",
        },
    )
    conflicts = _detect_conflicts(state)
    assert any("negative" in c.lower() for c in conflicts), \
        f"Expected news/trend conflict, got: {conflicts}"


# ── Full agent integration tests ─────────────────────────────────────────────

def test_risk_agent_runs_without_market_data():
    """Risk agent should handle missing market data gracefully."""
    from unittest.mock import patch
    from app.agents.risk import risk_agent

    state = _make_full_state()
    with patch("app.agents.risk.get_historical_prices", return_value=None):
        result = risk_agent(state)

    assert result["risk_result"] is not None
    assert result["risk_status"] in ("completed", "unavailable")


def test_risk_agent_schema():
    """Risk result must include required fields."""
    from unittest.mock import patch
    from app.agents.risk import risk_agent

    state = _make_full_state()
    with patch("app.agents.risk.get_historical_prices", return_value=None):
        result = risk_agent(state)

    if result["risk_status"] == "completed":
        rr = result["risk_result"]
        assert "volatility" in rr, "Missing 'volatility'"
        assert "risk_score" in rr or "overall_risk" in rr, "Missing risk score"
        assert isinstance(rr.get("conflicts", []), list), "conflicts must be a list"


def test_risk_agent_tcs_bse():
    """Risk agent with TCS on BSE."""
    from unittest.mock import patch
    from app.agents.risk import risk_agent

    state = _make_full_state("TCS", "BSE")
    with patch("app.agents.risk.get_historical_prices", return_value=None):
        result = risk_agent(state)

    assert result["risk_result"] is not None


def test_risk_score_range():
    """Risk score must be within a valid range (0-10 or 0-100)."""
    from unittest.mock import patch
    from app.agents.risk import risk_agent

    state = _make_full_state()
    with patch("app.agents.risk.get_historical_prices", return_value=None):
        result = risk_agent(state)

    if result["risk_status"] == "completed":
        rr = result["risk_result"]
        score = rr.get("risk_score") or rr.get("overall_risk")
        if score is not None and isinstance(score, (int, float)):
            assert 0 <= score <= 100, f"Risk score out of range: {score}"
