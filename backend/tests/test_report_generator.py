"""Tests for the Report Generation Agent."""
import pytest
from unittest.mock import patch
from app.agents.state import ResearchState


def _make_rich_state(ticker="RELIANCE", market="NSE") -> ResearchState:
    """State with all 4 agent results completed."""
    return ResearchState(
        task_id="test-report-001",
        ticker=ticker,
        market=market,
        yf_ticker=f"{ticker}.NS",
        period="1y",
        fundamental_result={
            "status": "completed",
            "ticker": ticker,
            "valuation": {"pe_ratio": 24.5, "pb_ratio": 2.1},
            "profitability": {"net_margin": 8.2, "roe": 15.3},
            "leverage": {"net_debt_cr": 50000},
            "limitations": [],
        },
        technical_result={
            "status": "completed",
            "ticker": ticker,
            "trend": "Bullish",
            "indicators": {"rsi_14": 58.0, "macd": 12.3, "sma_20": 2850, "sma_50": 2700},
        },
        news_result={
            "status": "completed",
            "ticker": ticker,
            "overall_sentiment": "positive",
            "total_articles": 5,
            "articles": [
                {
                    "title": f"{ticker} Q3 earnings beat estimates",
                    "source_url": "https://economictimes.com/sample",
                    "published_at": "2024-11-14",
                    "sentiment": "positive",
                }
            ],
        },
        risk_result={
            "status": "completed",
            "ticker": ticker,
            "volatility": "medium",
            "risk_score": 42,
            "max_drawdown": -18.5,
            "conflicts": [],
        },
        fundamental_status="completed",
        technical_status="completed",
        news_status="completed",
        risk_status="completed",
        sources=[{"source_url": "https://yfinance.com", "source_type": "market_data"}],
        conflicts=[],
        report_content=None,
        report_summary=None,
        report_limitations=None,
        report_status="pending",
        errors=[],
    )


def _make_minimal_state() -> ResearchState:
    """State with no agent results (all unavailable)."""
    return ResearchState(
        task_id="test-report-002",
        ticker="INFOSYS",
        market="NSE",
        yf_ticker="INFOSYS.NS",
        period="1y",
        fundamental_result=None,
        technical_result=None,
        news_result=None,
        risk_result=None,
        fundamental_status="unavailable",
        technical_status="unavailable",
        news_status="unavailable",
        risk_status="unavailable",
        sources=[],
        conflicts=[],
        report_content=None,
        report_summary=None,
        report_limitations=None,
        report_status="pending",
        errors=["fundamental unavailable", "technical unavailable"],
    )


# ── Report generation tests ───────────────────────────────────────────────────

def test_report_generated_with_ollama_offline():
    """Report agent should produce a fallback report if Ollama is unreachable."""
    from app.agents.report_generator import report_generator_agent

    state = _make_rich_state()
    with patch("app.agents.report_generator.ChatOllama", side_effect=Exception("Ollama offline")):
        result = report_generator_agent(state)

    assert result["report_content"] is not None, "Report content must not be None"
    assert len(result["report_content"]) > 100, "Report content is too short"
    assert result["report_status"] in ("completed", "failed")


def test_report_contains_ticker():
    """Report content should mention the ticker symbol."""
    from app.agents.report_generator import report_generator_agent

    state = _make_rich_state("TCS", "NSE")
    with patch("app.agents.report_generator.ChatOllama", side_effect=Exception("Ollama offline")):
        result = report_generator_agent(state)

    if result["report_status"] == "completed":
        assert "TCS" in result["report_content"], "Report should mention the ticker"


def test_report_contains_limitations():
    """Limitations field should be populated."""
    from app.agents.report_generator import report_generator_agent

    state = _make_rich_state()
    with patch("app.agents.report_generator.ChatOllama", side_effect=Exception("Ollama offline")):
        result = report_generator_agent(state)

    if result["report_status"] == "completed":
        assert result["report_limitations"] is not None, "Limitations must be set"
        assert len(result["report_limitations"]) > 10, "Limitations too short"


def test_report_with_all_unavailable_agents():
    """Report agent must not crash when all sub-agents are unavailable."""
    from app.agents.report_generator import report_generator_agent

    state = _make_minimal_state()
    with patch("app.agents.report_generator.ChatOllama", side_effect=Exception("Ollama offline")):
        result = report_generator_agent(state)

    assert result["report_content"] is not None
    assert result["report_status"] in ("completed", "failed")


def test_report_summary_field():
    """Report summary should be a non-empty string when completed."""
    from app.agents.report_generator import report_generator_agent

    state = _make_rich_state("HDFCBANK", "NSE")
    with patch("app.agents.report_generator.ChatOllama", side_effect=Exception("Ollama offline")):
        result = report_generator_agent(state)

    if result["report_status"] == "completed":
        assert result["report_summary"] is not None
        assert isinstance(result["report_summary"], str)
        assert len(result["report_summary"]) > 0


def test_report_status_is_valid():
    """Report status must be one of: completed, failed, pending."""
    from app.agents.report_generator import report_generator_agent

    state = _make_rich_state()
    with patch("app.agents.report_generator.ChatOllama", side_effect=Exception("Ollama offline")):
        result = report_generator_agent(state)

    assert result["report_status"] in ("completed", "failed", "pending"), \
        f"Invalid report_status: {result['report_status']}"


def test_report_hdfcbank_bse():
    """Report agent with HDFCBANK on BSE."""
    from app.agents.report_generator import report_generator_agent

    state = _make_rich_state("HDFCBANK", "BSE")
    state = ResearchState(**{**state, "market": "BSE", "yf_ticker": "HDFCBANK.BO"})
    with patch("app.agents.report_generator.ChatOllama", side_effect=Exception("Ollama offline")):
        result = report_generator_agent(state)

    assert result["report_content"] is not None
