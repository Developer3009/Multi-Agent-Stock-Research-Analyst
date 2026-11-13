"""
Milestone 2 — Fundamental Analysis Agent Tests
Tests: ratio correctness, edge cases, unavailable handling, schema validation.
"""
import pytest
from unittest.mock import patch, MagicMock
from app.agents.fundamental import fundamental_agent, _safe_pct
from app.agents.state import ResearchState


def _make_state(**overrides) -> ResearchState:
    base = ResearchState(
        task_id="test-task-001",
        ticker="RELIANCE",
        market="NSE",
        yf_ticker="RELIANCE.NS",
        period="1y",
        fundamental_result=None,
        technical_result=None,
        news_result=None,
        risk_result=None,
        fundamental_status="pending",
        technical_status="pending",
        news_status="pending",
        risk_status="pending",
        sources=[],
        conflicts=[],
        report_content=None,
        report_summary=None,
        report_limitations=None,
        report_status="pending",
        errors=[],
    )
    base.update(overrides)
    return base


# ── Helper Function Tests ──────────────────────────────────────────────────────

def test_safe_pct_normal():
    """Net margin = (1000 / 10000) * 100 = 10.0"""
    assert _safe_pct(1000, 10000) == 10.0

def test_safe_pct_zero_base():
    """Should return None when base is zero to avoid division by zero."""
    assert _safe_pct(1000, 0) is None

def test_safe_pct_none_value():
    """Should return None when value is None."""
    assert _safe_pct(None, 10000) is None

def test_safe_pct_negative_income():
    """Negative net income should produce negative net margin."""
    result = _safe_pct(-500, 10000)
    assert result == -5.0


# ── Agent Behavior Tests ───────────────────────────────────────────────────────

MOCK_STOCK_INFO = {
    "name": "Reliance Industries Ltd",
    "sector": "Energy",
    "industry": "Oil & Gas",
    "current_price": 2800.0,
    "market_cap": 18_000_000_000_000,
    "pe_ratio": 24.5,
    "pb_ratio": 2.3,
    "dividend_yield": 0.004,
    "52w_high": 3200.0,
    "52w_low": 2200.0,
    "beta": 0.98,
    "revenue": 9_000_000_000_000,
    "net_income": 750_000_000_000,
    "roe": 0.14,
    "total_debt": 3_000_000_000_000,
    "cash": 1_500_000_000_000,
    "employees": 236000,
    "website": "https://www.ril.com",
    "summary": "Reliance Industries is a conglomerate based in India.",
}

MOCK_FINANCIALS = {
    "income_statement": {"Total Revenue": {2024: 9_000_000_000_000}},
    "balance_sheet": {"Total Debt": {2024: 3_000_000_000_000}},
    "cash_flow": {"Free Cash Flow": {2024: 500_000_000_000}},
    "error": None,
}


@patch("app.agents.fundamental.get_financial_statements", return_value=MOCK_FINANCIALS)
@patch("app.agents.fundamental.get_stock_info", return_value=MOCK_STOCK_INFO)
def test_fundamental_agent_completed(mock_info, mock_financials):
    """Full happy-path: agent should return status=completed with all ratio sections."""
    state = _make_state()
    result = fundamental_agent(state)

    assert result["fundamental_status"] == "completed"
    data = result["fundamental_result"]
    assert data["status"] == "completed"
    assert data["company"]["name"] == "Reliance Industries Ltd"
    assert data["valuation"]["pe_ratio"] == 24.5
    assert data["profitability"]["net_margin"] == round((750e9 / 9000e9) * 100, 2)
    assert data["financial_health"]["net_debt"] == 3_000e9 - 1_500e9


@patch("app.agents.fundamental.get_financial_statements", return_value=MOCK_FINANCIALS)
@patch("app.agents.fundamental.get_stock_info", return_value=MOCK_STOCK_INFO)
def test_fundamental_agent_adds_source(mock_info, mock_financials):
    """Agent must append at least one source to the sources list."""
    state = _make_state()
    result = fundamental_agent(state)
    assert len(result["sources"]) >= 1
    assert "RELIANCE" in result["sources"][0]["title"]


@patch("app.agents.fundamental.get_financial_statements", return_value={"error": None})
@patch("app.agents.fundamental.get_stock_info", return_value={"error": "No data"})
def test_fundamental_agent_unavailable_on_no_data(mock_info, mock_financials):
    """If stock info fails to return a name, status should be unavailable."""
    state = _make_state()
    result = fundamental_agent(state)
    assert result["fundamental_status"] == "unavailable"
    assert result["fundamental_result"]["status"] == "unavailable"


@patch("app.agents.fundamental.get_financial_statements", side_effect=Exception("Network timeout"))
@patch("app.agents.fundamental.get_stock_info", side_effect=Exception("Network timeout"))
def test_fundamental_agent_handles_exception(mock_info, mock_financials):
    """Agent must catch exceptions, set status=failed, log error, never raise."""
    state = _make_state()
    result = fundamental_agent(state)
    assert result["fundamental_status"] == "failed"
    assert len(result["errors"]) == 1
    assert "Network timeout" in result["errors"][0]


@patch("app.agents.fundamental.get_financial_statements", return_value=MOCK_FINANCIALS)
@patch("app.agents.fundamental.get_stock_info", return_value={
    **MOCK_STOCK_INFO, "pe_ratio": None, "roe": None, "revenue": None
})
def test_fundamental_agent_records_data_limitations(mock_info, mock_financials):
    """Missing key metrics should be recorded in data_limitations."""
    state = _make_state()
    result = fundamental_agent(state)
    limitations = result["fundamental_result"].get("data_limitations", [])
    assert any("P/E" in l for l in limitations)
    assert any("Return on Equity" in l or "ROE" in l for l in limitations)


@patch("app.agents.fundamental.get_financial_statements", return_value=MOCK_FINANCIALS)
@patch("app.agents.fundamental.get_stock_info", return_value={
    **MOCK_STOCK_INFO, "net_income": -200_000_000_000
})
def test_fundamental_negative_net_margin(mock_info, mock_financials):
    """Negative net income should produce a negative net margin value."""
    state = _make_state()
    result = fundamental_agent(state)
    margin = result["fundamental_result"]["profitability"]["net_margin"]
    assert margin < 0, "Expected negative net margin for loss-making company"


@patch("app.agents.fundamental.get_financial_statements", return_value=MOCK_FINANCIALS)
@patch("app.agents.fundamental.get_stock_info", return_value={
    **MOCK_STOCK_INFO, "total_debt": None, "cash": None
})
def test_fundamental_net_debt_none_when_data_missing(mock_info, mock_financials):
    """Net debt should be None when both debt and cash data are missing."""
    state = _make_state()
    result = fundamental_agent(state)
    net_debt = result["fundamental_result"]["financial_health"]["net_debt"]
    assert net_debt is None


@patch("app.agents.fundamental.get_financial_statements", return_value=MOCK_FINANCIALS)
@patch("app.agents.fundamental.get_stock_info", return_value=MOCK_STOCK_INFO)
def test_fundamental_no_password_hash_or_sensitive_data(mock_info, mock_financials):
    """Fundamental result must NOT contain any user or auth data fields."""
    state = _make_state()
    result = fundamental_agent(state)
    result_str = str(result["fundamental_result"])
    assert "password" not in result_str.lower()
    assert "user_id" not in result_str.lower()
