from typing import TypedDict, Optional, List, Dict, Any


class ResearchState(TypedDict):
    """LangGraph state shared across all agents."""
    task_id: str
    ticker: str
    market: str            # NSE or BSE
    yf_ticker: str         # e.g. RELIANCE.NS
    period: str            # e.g. 1y

    # Agent outputs
    fundamental_result: Optional[Dict[str, Any]]
    technical_result: Optional[Dict[str, Any]]
    news_result: Optional[Dict[str, Any]]
    risk_result: Optional[Dict[str, Any]]

    # Statuses per agent
    fundamental_status: str   # pending | completed | failed | unavailable
    technical_status: str
    news_status: str
    risk_status: str

    # Collected sources
    sources: List[Dict[str, Any]]

    # Conflicts detected by risk agent
    conflicts: List[str]

    # Final report
    report_content: Optional[str]
    report_summary: Optional[str]
    report_limitations: Optional[str]
    report_status: str

    # Error tracking
    errors: List[str]
