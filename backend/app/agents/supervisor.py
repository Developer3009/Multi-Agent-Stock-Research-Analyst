"""Supervisor Agent — LangGraph orchestration of all research agents."""
from langgraph.graph import StateGraph, END
from app.agents.state import ResearchState
from app.agents.fundamental import fundamental_agent
from app.agents.technical import technical_agent
from app.agents.news import news_agent
from app.agents.risk import risk_agent
from app.agents.report_generator import report_generator_agent
from app.services.market_data import get_yf_ticker


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


def _should_generate_report(state: ResearchState) -> str:
    """Conditional edge: always proceed to report generation."""
    return "generate_report"


def build_research_graph():
    """Build and compile the LangGraph research workflow."""
    workflow = StateGraph(ResearchState)

    # Add agent nodes
    workflow.add_node("fundamental", fundamental_agent)
    workflow.add_node("technical", technical_agent)
    workflow.add_node("news", news_agent)
    workflow.add_node("risk", risk_agent)
    workflow.add_node("generate_report", report_generator_agent)

    # Define execution order
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


async def run_research_workflow(task_id: str, ticker: str, market: str, period: str = "1y") -> ResearchState:
    """Run the full multi-agent research workflow."""
    initial_state = _init_state(task_id, ticker, market, period)
    final_state = research_graph.invoke(initial_state)
    return final_state
