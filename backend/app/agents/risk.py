"""Risk Analysis Agent — evaluates volatility, drawdown, and cross-agent conflicts."""
import numpy as np
import pandas as pd
from typing import List, Optional
from app.services.market_data import get_historical_prices
from app.agents.state import ResearchState


def _max_drawdown(close: pd.Series) -> Optional[float]:
    """Calculate maximum drawdown as percentage."""
    if len(close) < 2:
        return None
    rolling_max = close.cummax()
    drawdown = (close - rolling_max) / rolling_max
    return round(float(drawdown.min()) * 100, 2)


def _detect_conflicts(state: ResearchState) -> List[str]:
    """Detect conflicting signals between agents."""
    conflicts = []

    tech = state.get("technical_result", {}) or {}
    fund = state.get("fundamental_result", {}) or {}
    news = state.get("news_result", {}) or {}

    if tech.get("status") == "completed" and fund.get("status") == "completed":
        trend = tech.get("trend", "").lower()
        rsi = tech.get("indicators", {}).get("rsi_14")
        net_margin = fund.get("profitability", {}).get("net_margin")
        pe = fund.get("valuation", {}).get("pe_ratio")

        if "bullish" in trend and net_margin is not None and net_margin < 0:
            conflicts.append(
                "⚠️ CONFLICT: Technical indicators show bullish signals, but fundamental analysis reveals negative net profit margin."
            )

        if rsi and rsi > 70 and pe and pe > 50:
            conflicts.append(
                f"⚠️ CONFLICT: RSI ({rsi}) indicates overbought conditions AND P/E ratio ({pe:.1f}x) is elevated. Valuation risk is high."
            )

    if tech.get("status") == "completed" and news.get("status") == "completed":
        trend = tech.get("trend", "").lower()
        sentiment = news.get("overall_sentiment", "").lower()

        if "bullish" in trend and "negative" in sentiment:
            conflicts.append(
                "⚠️ CONFLICT: Technical trend appears bullish, but recent news sentiment is predominantly negative."
            )
        elif "bearish" in trend and "positive" in sentiment:
            conflicts.append(
                "⚠️ CONFLICT: Technical trend appears bearish, but recent news sentiment is predominantly positive."
            )

    return conflicts


def risk_agent(state: ResearchState) -> ResearchState:
    """Risk Analysis Agent."""
    ticker = state["ticker"]
    market = state["market"]
    period = state.get("period", "1y")

    try:
        df = get_historical_prices(ticker, market, period)

        price_risk = {}
        if df is not None and not df.empty:
            close = df["Close"]
            log_returns = np.log(close / close.shift(1)).dropna()

            price_risk = {
                "historical_volatility_annualized_pct": round(
                    float(log_returns.std() * np.sqrt(252) * 100), 2
                ),
                "max_drawdown_pct": _max_drawdown(close),
                "avg_daily_return_pct": round(float(log_returns.mean() * 100), 4),
                "value_at_risk_95_pct": round(float(np.percentile(log_returns, 5) * 100), 2),
            }

            vol = price_risk.get("historical_volatility_annualized_pct", 0)
            if vol > 50:
                price_risk["volatility_rating"] = "Very High"
            elif vol > 30:
                price_risk["volatility_rating"] = "High"
            elif vol > 20:
                price_risk["volatility_rating"] = "Moderate"
            else:
                price_risk["volatility_rating"] = "Low"
        else:
            price_risk = {"error": "Historical data unavailable for risk calculation"}

        conflicts = _detect_conflicts(state)
        state["conflicts"] = conflicts

        data_gaps = []
        if state.get("fundamental_status") in ("failed", "unavailable"):
            data_gaps.append("Fundamental analysis data is unavailable")
        if state.get("technical_status") in ("failed", "unavailable"):
            data_gaps.append("Technical analysis data is unavailable")
        if state.get("news_status") in ("failed", "unavailable"):
            data_gaps.append("News data is unavailable")

        fund_risks = []
        fund = state.get("fundamental_result", {}) or {}
        if fund.get("status") == "completed":
            if fund.get("profitability", {}).get("net_margin") is not None:
                if fund["profitability"]["net_margin"] < 0:
                    fund_risks.append("Company is currently unprofitable (negative net margin)")
            if fund.get("valuation", {}).get("pe_ratio"):
                pe = fund["valuation"]["pe_ratio"]
                if pe > 60:
                    fund_risks.append(f"High valuation risk — P/E ratio of {pe:.1f}x")
            if fund.get("valuation", {}).get("beta"):
                beta = fund["valuation"]["beta"]
                if beta > 1.5:
                    fund_risks.append(f"High market sensitivity — Beta of {beta:.2f}")

        result = {
            "status": "completed",
            "price_risk": price_risk,
            "fundamental_risks": fund_risks,
            "conflicts_detected": conflicts,
            "data_gaps": data_gaps,
            "overall_risk_level": _overall_risk_level(price_risk, conflicts, fund_risks),
            "disclaimer": (
                "Risk metrics are based on historical data and do not guarantee future outcomes. "
                "Investors should conduct their own due diligence."
            ),
        }

        state["risk_result"] = result
        state["risk_status"] = "completed"

    except Exception as e:
        state["risk_status"] = "failed"
        state["risk_result"] = {"status": "failed", "error": str(e)}
        state["errors"].append(f"Risk agent error: {str(e)}")

    return state


def _overall_risk_level(price_risk: dict, conflicts: list, fund_risks: list) -> str:
    score = 0
    vol = price_risk.get("historical_volatility_annualized_pct", 0)
    if vol > 50:
        score += 3
    elif vol > 30:
        score += 2
    elif vol > 20:
        score += 1

    score += min(len(conflicts), 3)
    score += min(len(fund_risks), 2)

    if score >= 6:
        return "Very High"
    elif score >= 4:
        return "High"
    elif score >= 2:
        return "Moderate"
    return "Low"
