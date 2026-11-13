"""Supervisor Agent — LangGraph orchestration with parallel Wave 1 + retry logic."""
import asyncio
import logging
from typing import Optional
from langgraph.graph import StateGraph, END
from app.agents.state import ResearchState
from app.agents.fundamental import fundamental_agent
from app.agents.technical import technical_agent
from app.agents.news import news_agent
from app.agents.risk import risk_agent
from app.agents.report_generator import report_generator_agent
from app.services.market_data import get_yf_ticker

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 2.0  # seconds


def _init_state(task_id: str, ticker: str, market: str, period: str) -> ResearchState:
    """Initialize a fresh research state."""
    return ResearchState(
        task_id=task_id,
        ticker=ticker.upper(),
        market=market.upper(),
        yf_ticker=get_yf_ticker(ticker, market),
        period=period,
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


async def _run_agent_with_retry(
    agent_fn,
    state: ResearchState,
    agent_name: str,
    status_key: str,
) -> ResearchState:
    """Run an agent with exponential-backoff retry. Returns updated state slice."""
    last_exc: Optional[Exception] = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            # Agent functions are synchronous — run in thread pool
            loop = asyncio.get_event_loop()
            result_state = await loop.run_in_executor(None, agent_fn, state)
            return result_state
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "Agent %s attempt %d/%d failed: %s",
                agent_name, attempt + 1, MAX_RETRIES + 1, exc,
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY * (2 ** attempt))

    # All retries exhausted
    logger.error("Agent %s failed after %d retries: %s", agent_name, MAX_RETRIES + 1, last_exc)
    error_state = dict(state)
    error_state[status_key] = "unavailable"
    error_state["errors"] = list(state.get("errors", [])) + [
        f"{agent_name} unavailable after {MAX_RETRIES + 1} attempts: {last_exc}"
    ]
    return ResearchState(**error_state)


def _merge_wave1(base: ResearchState, results: list) -> ResearchState:
    """Merge Wave 1 parallel results into a single state."""
    merged = dict(base)
    keys_to_merge = [
        ("fundamental_result", "fundamental_status", "sources", "errors"),
        ("technical_result", "technical_status", "sources", "errors"),
        ("news_result", "news_status", "sources", "errors"),
    ]
    for i, key_group in enumerate(keys_to_merge):
        result = results[i]
        if isinstance(result, Exception):
            # Should not happen — _run_agent_with_retry absorbs exceptions
            continue
        result_dict = dict(result)
        result_key, status_key, _, _ = key_group
        merged[result_key] = result_dict.get(result_key)
        merged[status_key] = result_dict.get(status_key, "failed")
        # Accumulate sources and errors (deduplicated by content)
        for extra_key in ("sources", "errors"):
            existing = merged.get(extra_key, [])
            new_items = result_dict.get(extra_key, [])
            combined = existing + [x for x in new_items if x not in existing]
            merged[extra_key] = combined
    return ResearchState(**merged)


async def run_research_workflow(
    task_id: str,
    ticker: str,
    market: str,
    period: str = "1y",
    status_callback=None,
) -> ResearchState:
    """
    Run the full multi-agent research workflow.

    Wave 1 (parallel): fundamental, technical, news agents
    Wave 2 (sequential): risk agent (needs Wave 1 outputs)
    Wave 3 (sequential): report generator

    Args:
        status_callback: optional async callable(agent_name, status) for real-time updates
    """
    state = _init_state(task_id, ticker, market, period)

    async def _notify(agent_name: str, status: str):
        if status_callback:
            try:
                await status_callback(agent_name, status)
            except Exception:
                pass

    # ── Wave 1: Parallel ────────────────────────────────────────────────────
    await _notify("fundamental", "running")
    await _notify("technical", "running")
    await _notify("news", "running")

    wave1_tasks = await asyncio.gather(
        _run_agent_with_retry(fundamental_agent, state, "fundamental", "fundamental_status"),
        _run_agent_with_retry(technical_agent, state, "technical", "technical_status"),
        _run_agent_with_retry(news_agent, state, "news", "news_status"),
        return_exceptions=True,
    )

    state = _merge_wave1(state, list(wave1_tasks))

    await _notify("fundamental", state["fundamental_status"])
    await _notify("technical", state["technical_status"])
    await _notify("news", state["news_status"])

    # ── Wave 2: Risk (needs Wave 1 outputs) ─────────────────────────────────
    await _notify("risk", "running")
    state = await _run_agent_with_retry(risk_agent, state, "risk", "risk_status")
    await _notify("risk", state["risk_status"])

    # ── Wave 3: Report generation ────────────────────────────────────────────
    await _notify("report", "running")
    try:
        loop = asyncio.get_event_loop()
        state = await loop.run_in_executor(None, report_generator_agent, state)
    except Exception as exc:
        logger.error("Report generation failed: %s", exc)
        merged = dict(state)
        merged["report_status"] = "failed"
        merged["errors"] = list(state.get("errors", [])) + [f"report_generator: {exc}"]
        state = ResearchState(**merged)

    await _notify("report", state.get("report_status", "failed"))
    return state


# ── LangGraph graph (kept for compatibility / testing) ───────────────────────

def _should_generate_report(state: ResearchState) -> str:
    return "generate_report"


def build_research_graph():
    """Build and compile the LangGraph research workflow (sequential, for testing)."""
    workflow = StateGraph(ResearchState)
    workflow.add_node("fundamental", fundamental_agent)
    workflow.add_node("technical", technical_agent)
    workflow.add_node("news", news_agent)
    workflow.add_node("risk", risk_agent)
    workflow.add_node("generate_report", report_generator_agent)
    workflow.set_entry_point("fundamental")
    workflow.add_edge("fundamental", "technical")
    workflow.add_edge("technical", "news")
    workflow.add_edge("news", "risk")
    workflow.add_conditional_edges(
        "risk",
        _should_generate_report,
        {"generate_report": "generate_report"},
    )
    workflow.add_edge("generate_report", END)
    return workflow.compile()


research_graph = build_research_graph()
