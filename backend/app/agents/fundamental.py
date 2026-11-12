"""Fundamental Analysis Agent — analyzes financial health of a company."""
from typing import Any, Dict, Optional
from app.services.market_data import get_stock_info, get_financial_statements
from app.agents.state import ResearchState
import pandas as pd


def _safe_pct(value, base) -> Optional[float]:
    try:
        if base and base != 0:
            return round((value / base) * 100, 2)
        return None
    except Exception:
        return None


def fundamental_agent(state: ResearchState) -> ResearchState:
    """
    Fundamental Analysis Agent.
    Fetches stock info and financial statements; computes key ratios.
    """
    ticker = state["ticker"]
    market = state["market"]

    try:
        info = get_stock_info(ticker, market)
        financials = get_financial_statements(ticker, market)

        if not info or ("error" in info and info.get("name") is None):
            state["fundamental_status"] = "unavailable"
            state["fundamental_result"] = {
                "status": "unavailable",
                "reason": info.get("error", "No data returned") if info else "No data returned",
            }
            return state

        result: Dict[str, Any] = {
            "company": {
                "name": info.get("name"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "employees": info.get("employees"),
                "website": info.get("website"),
                "summary": info.get("summary"),
            },
            "valuation": {
                "current_price": info.get("current_price"),
                "market_cap": info.get("market_cap"),
                "pe_ratio": info.get("pe_ratio"),
                "pb_ratio": info.get("pb_ratio"),
                "dividend_yield": info.get("dividend_yield"),
                "52w_high": info.get("52w_high"),
                "52w_low": info.get("52w_low"),
                "beta": info.get("beta"),
            },
            "profitability": {
                "revenue": info.get("revenue"),
                "net_income": info.get("net_income"),
                "roe": info.get("roe"),
                "net_margin": _safe_pct(info.get("net_income"), info.get("revenue")),
            },
            "financial_health": {
                "total_debt": info.get("total_debt"),
                "cash": info.get("cash"),
                "net_debt": (
                    (info.get("total_debt") or 0) - (info.get("cash") or 0)
                    if info.get("total_debt") is not None
                    else None
                ),
            },
            "financial_statements_available": {
                "income_statement": financials.get("income_statement") is not None,
                "balance_sheet": financials.get("balance_sheet") is not None,
                "cash_flow": financials.get("cash_flow") is not None,
            },
            "data_limitations": [],
        }

        limitations = []
        if not info.get("pe_ratio"):
            limitations.append("P/E ratio not available")
        if not info.get("roe"):
            limitations.append("Return on Equity not available")
        if not info.get("revenue"):
            limitations.append("Revenue data not available")
        if financials.get("error"):
            limitations.append(f"Financial statements error: {financials['error']}")

        result["data_limitations"] = limitations
        result["status"] = "completed"

        state["fundamental_result"] = result
        state["fundamental_status"] = "completed"
        state["sources"].append({
            "source_type": "financial_data",
            "title": f"{ticker} Financial Data",
            "source_url": f"https://finance.yahoo.com/quote/{state['yf_ticker']}",
            "published_at": None,
        })

    except Exception as e:
        state["fundamental_status"] = "failed"
        state["fundamental_result"] = {"status": "failed", "error": str(e)}
        state["errors"].append(f"Fundamental agent error: {str(e)}")

    return state
