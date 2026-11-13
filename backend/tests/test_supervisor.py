"""Tests for the Supervisor Agent — state init, graph compilation, parallel execution."""
import pytest
import asyncio
from unittest.mock import patch, MagicMock
from app.agents.state import ResearchState


def _make_base_state() -> ResearchState:
    return ResearchState(
        task_id="test-sup-001",
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


# ── State initialization ─────────────────────────────────────────────────────

def test_init_state_nse():
    """State initializer should create correct NSE yf_ticker."""
    from app.agents.supervisor import _init_state

    state = _init_state("task-001", "RELIANCE", "NSE", "1y")
    assert state["ticker"] == "RELIANCE"
    assert state["market"] == "NSE"
    assert state["yf_ticker"].endswith(".NS"), f"NSE ticker should end with .NS, got {state['yf_ticker']}"
    assert state["fundamental_status"] == "pending"
    assert state["report_status"] == "pending"
    assert isinstance(state["errors"], list)
    assert len(state["errors"]) == 0


def test_init_state_bse():
    """State initializer should create correct BSE yf_ticker."""
    from app.agents.supervisor import _init_state

    state = _init_state("task-002", "TCS", "BSE", "6mo")
    assert state["market"] == "BSE"
    assert state["yf_ticker"].endswith(".BO"), f"BSE ticker should end with .BO, got {state['yf_ticker']}"
    assert state["period"] == "6mo"


def test_init_state_ticker_uppercased():
    """Ticker should always be uppercased regardless of input."""
    from app.agents.supervisor import _init_state

    state = _init_state("task-003", "reliance", "nse", "1y")
    assert state["ticker"] == "RELIANCE"
    assert state["market"] == "NSE"


# ── LangGraph graph compilation ──────────────────────────────────────────────

def test_build_research_graph_compiles():
    """Graph should compile without errors."""
    from app.agents.supervisor import build_research_graph

    graph = build_research_graph()
    assert graph is not None


def test_research_graph_singleton():
    """The module-level research_graph should be accessible."""
    from app.agents.supervisor import research_graph

    assert research_graph is not None


# ── Merge Wave 1 ─────────────────────────────────────────────────────────────

def test_merge_wave1_accumulates_sources():
    """Merging Wave 1 results should accumulate sources without duplicates."""
    from app.agents.supervisor import _merge_wave1

    base = _make_base_state()
    base["sources"] = [{"source_url": "https://existing.com"}]

    r1 = dict(base)
    r1["fundamental_result"] = {"pe_ratio": 20}
    r1["fundamental_status"] = "completed"
    r1["sources"] = [{"source_url": "https://yfinance.com"}]
    r1["errors"] = []

    r2 = dict(base)
    r2["technical_result"] = {"trend": "Bullish"}
    r2["technical_status"] = "completed"
    r2["sources"] = [{"source_url": "https://yfinance.com"}, {"source_url": "https://charts.com"}]
    r2["errors"] = []

    r3 = dict(base)
    r3["news_result"] = {"articles": []}
    r3["news_status"] = "completed"
    r3["sources"] = []
    r3["errors"] = []

    merged = _merge_wave1(base, [ResearchState(**r1), ResearchState(**r2), ResearchState(**r3)])
    # Sources from r1 + r2 merged (no duplicates for yfinance.com)
    urls = [s["source_url"] for s in merged["sources"]]
    assert len(urls) == len(set(urls)), "Sources should not have duplicates"


def test_merge_wave1_statuses():
    """Merge should capture correct per-agent statuses."""
    from app.agents.supervisor import _merge_wave1

    base = _make_base_state()

    r1 = dict(base); r1["fundamental_status"] = "completed"; r1["fundamental_result"] = {}
    r1["sources"] = []; r1["errors"] = []
    r2 = dict(base); r2["technical_status"] = "unavailable"; r2["technical_result"] = None
    r2["sources"] = []; r2["errors"] = ["technical failed"]
    r3 = dict(base); r3["news_status"] = "completed"; r3["news_result"] = {}
    r3["sources"] = []; r3["errors"] = []

    merged = _merge_wave1(base, [ResearchState(**r1), ResearchState(**r2), ResearchState(**r3)])
    assert merged["fundamental_status"] == "completed"
    assert merged["technical_status"] == "unavailable"
    assert merged["news_status"] == "completed"
    assert "technical failed" in merged["errors"]


# ── Async workflow tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_research_workflow_partial_failure():
    """Workflow should complete even if one Wave 1 agent fails all retries."""
    from app.agents.supervisor import run_research_workflow

    def good_fundamental(state):
        s = dict(state)
        s["fundamental_result"] = {"pe_ratio": 22.0}
        s["fundamental_status"] = "completed"
        return ResearchState(**s)

    def bad_technical(state):
        raise RuntimeError("Yahoo Finance timeout")

    def good_news(state):
        s = dict(state)
        s["news_result"] = {"articles": [], "overall_sentiment": "neutral", "total_articles": 0}
        s["news_status"] = "completed"
        return ResearchState(**s)

    def good_risk(state):
        s = dict(state)
        s["risk_result"] = {"volatility": "medium", "risk_score": 40}
        s["risk_status"] = "completed"
        return ResearchState(**s)

    def good_report(state):
        s = dict(state)
        s["report_content"] = "Test report"
        s["report_summary"] = "Summary"
        s["report_limitations"] = "None"
        s["report_status"] = "completed"
        return ResearchState(**s)

    with patch("app.agents.supervisor.fundamental_agent", side_effect=good_fundamental), \
         patch("app.agents.supervisor.technical_agent", side_effect=bad_technical), \
         patch("app.agents.supervisor.news_agent", side_effect=good_news), \
         patch("app.agents.supervisor.risk_agent", side_effect=good_risk), \
         patch("app.agents.supervisor.report_generator_agent", side_effect=good_report):
        result = await run_research_workflow("task-p01", "RELIANCE", "NSE", "1y")

    assert result["fundamental_status"] == "completed"
    assert result["technical_status"] == "unavailable"  # Failed → unavailable
    assert result["news_status"] == "completed"
    assert result["report_status"] == "completed"


@pytest.mark.asyncio
async def test_run_research_workflow_all_success():
    """Full happy-path workflow should return completed statuses."""
    from app.agents.supervisor import run_research_workflow

    def mk_agent(result_key, status_key, result_val):
        def agent(state):
            s = dict(state)
            s[result_key] = result_val
            s[status_key] = "completed"
            return ResearchState(**s)
        return agent

    with patch("app.agents.supervisor.fundamental_agent",
               side_effect=mk_agent("fundamental_result", "fundamental_status", {"pe_ratio": 20})), \
         patch("app.agents.supervisor.technical_agent",
               side_effect=mk_agent("technical_result", "technical_status", {"trend": "Bullish"})), \
         patch("app.agents.supervisor.news_agent",
               side_effect=mk_agent("news_result", "news_status", {"articles": []})), \
         patch("app.agents.supervisor.risk_agent",
               side_effect=mk_agent("risk_result", "risk_status", {"risk_score": 30})), \
         patch("app.agents.supervisor.report_generator_agent",
               side_effect=lambda s: {**s, "report_content": "Report", "report_status": "completed"}):
        result = await run_research_workflow("task-s01", "TCS", "NSE", "1y")

    assert result["fundamental_status"] == "completed"
    assert result["technical_status"] == "completed"
    assert result["news_status"] == "completed"
    assert result["risk_status"] == "completed"
