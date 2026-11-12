"""Report Generation Agent — combines all agent outputs into a structured report using Ollama."""
from app.agents.state import ResearchState
from app.config import settings
from langchain_ollama import ChatOllama
from langchain.schema import HumanMessage


def _build_context(state: ResearchState) -> str:
    """Build a text context from all agent results for the LLM."""
    lines = []
    ticker = state["ticker"]
    market = state["market"]

    lines.append(f"Stock: {ticker} | Market: {market}")

    # Fundamental
    fund = state.get("fundamental_result") or {}
    if fund.get("status") == "completed":
        comp = fund.get("company", {})
        val = fund.get("valuation", {})
        prof = fund.get("profitability", {})
        health = fund.get("financial_health", {})
        lines.append("\n## FUNDAMENTAL DATA")
        lines.append(f"Company: {comp.get('name')} | Sector: {comp.get('sector')} | Industry: {comp.get('industry')}")
        lines.append(f"Market Cap: {val.get('market_cap')} | P/E: {val.get('pe_ratio')} | P/B: {val.get('pb_ratio')}")
        lines.append(f"Revenue: {prof.get('revenue')} | Net Income: {prof.get('net_income')} | Net Margin: {prof.get('net_margin')}%")
        lines.append(f"Total Debt: {health.get('total_debt')} | Cash: {health.get('cash')} | Net Debt: {health.get('net_debt')}")
        lines.append(f"ROE: {val.get('roe')} | Dividend Yield: {val.get('dividend_yield')} | Beta: {val.get('beta')}")
        lines.append(f"52W High: {val.get('52w_high')} | 52W Low: {val.get('52w_low')}")
        if fund.get("data_limitations"):
            lines.append(f"Limitations: {', '.join(fund['data_limitations'])}")
    else:
        lines.append("\n## FUNDAMENTAL DATA: Unavailable")

    # Technical
    tech = state.get("technical_result") or {}
    if tech.get("status") == "completed":
        ind = tech.get("indicators", {})
        ps = tech.get("price_summary", {})
        lines.append("\n## TECHNICAL DATA")
        lines.append(f"Current Price: {ps.get('current_price')} | Period Change: {ps.get('price_change_pct')}%")
        lines.append(f"SMA20: {ind.get('sma_20')} | SMA50: {ind.get('sma_50')} | SMA200: {ind.get('sma_200')}")
        lines.append(f"RSI(14): {ind.get('rsi_14')} — {ind.get('rsi_signal')}")
        lines.append(f"MACD: {ind.get('macd_line')} | Signal: {ind.get('macd_signal_line')} — {ind.get('macd_signal')}")
        lines.append(f"Volatility (annualized): {ind.get('historical_volatility_annualized_pct')}%")
        lines.append(f"Trend: {tech.get('trend')}")
    else:
        lines.append("\n## TECHNICAL DATA: Unavailable")

    # News
    news = state.get("news_result") or {}
    if news.get("status") == "completed":
        lines.append("\n## NEWS & SENTIMENT")
        lines.append(f"Overall Sentiment: {news.get('overall_sentiment')} | Articles Analyzed: {news.get('articles_analyzed')}")
        breakdown = news.get("sentiment_breakdown", {})
        lines.append(f"Positive: {breakdown.get('positive')} | Negative: {breakdown.get('negative')} | Neutral: {breakdown.get('neutral')}")
        for article in (news.get("articles") or [])[:5]:
            lines.append(f"- [{article.get('sentiment', 'neutral').upper()}] {article.get('title')} ({article.get('source', '')})")
    else:
        lines.append("\n## NEWS & SENTIMENT: Unavailable")

    # Risk
    risk = state.get("risk_result") or {}
    if risk.get("status") == "completed":
        pr = risk.get("price_risk", {})
        lines.append("\n## RISK DATA")
        lines.append(f"Overall Risk Level: {risk.get('overall_risk_level')}")
        lines.append(f"Annualized Volatility: {pr.get('historical_volatility_annualized_pct')}% | Max Drawdown: {pr.get('max_drawdown_pct')}%")
        lines.append(f"VaR (95%): {pr.get('value_at_risk_95_pct')}% | Volatility Rating: {pr.get('volatility_rating')}")
        if risk.get("fundamental_risks"):
            lines.append("Fundamental Risks: " + "; ".join(risk["fundamental_risks"]))
        if risk.get("conflicts_detected"):
            lines.append("CONFLICTS: " + "; ".join(risk["conflicts_detected"]))
    else:
        lines.append("\n## RISK DATA: Unavailable")

    return "\n".join(lines)


def report_generator_agent(state: ResearchState) -> ResearchState:
    """Report Generation Agent — uses Ollama to write the final research report."""
    context = _build_context(state)
    ticker = state["ticker"]
    market = state["market"]

    try:
        llm = ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.3,
        )

        prompt = f"""You are a professional stock research analyst. Based on the following data, write a comprehensive stock research report in Markdown format.

DATA:
{context}

Write a report with these exact sections:
1. **Executive Summary** (3-4 sentences overview)
2. **Company Overview** (business description, sector, key facts)
3. **Fundamental Analysis** (financial health, profitability, valuation ratios, interpretation)
4. **Technical Analysis** (price trend, indicator readings, what they historically suggest — NOT predictions)
5. **News & Sentiment Analysis** (recent developments, sentiment, notable events)
6. **Risk Assessment** (volatility, drawdown, identified risks, conflicts between analyses)
7. **Data Sources & Limitations** (what data was available/unavailable, source citations)
8. **Disclaimer** (this is not financial advice; past performance does not guarantee future results)

Be factual. Distinguish between measured data and analytical interpretation. Do NOT make investment recommendations. Do NOT predict future prices. If data is unavailable, say so explicitly rather than fabricating."""

        response = llm.invoke([HumanMessage(content=prompt)])
        report_content = response.content.strip()

        summary_prompt = f"""Summarize this stock research report in 3 sentences:

{report_content[:2000]}

Summary:"""
        summary_response = llm.invoke([HumanMessage(content=summary_prompt)])
        summary = summary_response.content.strip()

    except Exception as e:
        report_content = _build_fallback_report(state, context)
        summary = f"Research report for {ticker} ({market}). Data was collected from yfinance and financial news RSS feeds. LLM report generation was unavailable: {str(e)}"

    all_limitations = []
    for agent_key in ["fundamental_result", "technical_result", "news_result", "risk_result"]:
        result = state.get(agent_key) or {}
        if result.get("data_limitations"):
            all_limitations.extend(result["data_limitations"])
    if state.get("errors"):
        all_limitations.extend(state["errors"])

    state["report_content"] = report_content
    state["report_summary"] = summary
    state["report_limitations"] = "\n".join(all_limitations) if all_limitations else "No significant limitations noted."
    state["report_status"] = "completed"

    return state


def _build_fallback_report(state: ResearchState, context: str) -> str:
    """Build a structured report without LLM as fallback."""
    ticker = state["ticker"]
    market = state["market"]
    sections = [f"# Stock Research Report: {ticker} ({market})\n"]
    sections.append("*Report generated without LLM — data summary only*\n")
    sections.append("---\n")
    sections.append("## Raw Research Data\n")
    sections.append(f"```\n{context}\n```\n")
    sections.append("## Disclaimer\n")
    sections.append(
        "This report is for informational purposes only and does not constitute financial advice. "
        "Past performance does not guarantee future results. Always conduct your own research."
    )
    return "\n".join(sections)
