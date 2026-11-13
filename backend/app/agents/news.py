"""News & Sentiment Agent — fetches and classifies Indian financial news."""
from typing import List, Dict, Any
from app.services.news_service import fetch_news_for_ticker
from app.agents.state import ResearchState
from app.config import settings
from langchain_ollama import ChatOllama
from langchain.schema import HumanMessage
import json


def _classify_sentiment_local(title: str, summary: str = "") -> str:
    """
    Rule-based sentiment classification as fallback when LLM unavailable.
    Returns: positive | negative | neutral
    """
    text = (title + " " + summary).lower()
    positive_words = [
        "surge", "rally", "gain", "rise", "profit", "growth", "record", "high",
        "beat", "strong", "upgrade", "buy", "bullish", "positive", "expand",
        "acquisition", "deal", "win", "approval", "product launch", "dividend"
    ]
    negative_words = [
        "fall", "drop", "decline", "loss", "miss", "weak", "downgrade", "sell",
        "bearish", "negative", "cut", "risk", "concern", "fraud", "penalty",
        "investigation", "crash", "slump", "warning", "debt", "probe", "layoffs"
    ]
    pos_score = sum(1 for w in positive_words if w in text)
    neg_score = sum(1 for w in negative_words if w in text)
    if any(k in text for k in ("probe", "fraud", "scandal", "investigation", "penalty")):
        neg_score += 2
    if pos_score > neg_score:
        return "positive"
    elif neg_score > pos_score:
        return "negative"
    return "neutral"


_keyword_sentiment = _classify_sentiment_local


def _analyze_sentiment_with_ollama(articles: List[Dict]) -> List[Dict]:
    """Classify sentiment using high-speed keyword analysis with optional batched Ollama enhancement."""
    # 1. Base classification for all articles using optimized financial lexicon
    for a in articles:
        if not a.get("sentiment"):
            a["sentiment"] = _classify_sentiment_local(a["title"], a.get("summary", ""))
        a["category"] = a.get("category", "other")
        a["sentiment_reason"] = "Classified using financial lexicon analysis"

    # 2. Batch top 5 articles into a single Ollama prompt if available
    try:
        llm = ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0,
            timeout=8.0,
        )

        top_articles = articles[:5]
        headlines_text = "\n".join([f"{i+1}. {a['title']}" for i, a in enumerate(top_articles)])
        prompt = f"""Classify the financial sentiment of each headline as positive, negative, or neutral.
Also categorize as earnings, acquisition, regulatory, management_change, product_launch, or other.

HEADLINES:
{headlines_text}

Respond in JSON list only:
[{{"id": 1, "sentiment": "positive|negative|neutral", "category": "category"}}, ...]"""

        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content.strip()
        if "[" in content:
            json_str = content[content.find("["):content.rfind("]") + 1]
            items = json.loads(json_str)
            for item in items:
                idx = item.get("id", 1) - 1
                if 0 <= idx < len(top_articles):
                    top_articles[idx]["sentiment"] = item.get("sentiment", top_articles[idx]["sentiment"])
                    top_articles[idx]["category"] = item.get("category", "other")
                    top_articles[idx]["sentiment_reason"] = "Refined by Ollama AI agent"
    except Exception:
        pass

    return articles


def news_agent(state: ResearchState) -> ResearchState:
    """News & Sentiment Agent."""
    ticker = state["ticker"]

    try:
        company_name = None
        if state.get("fundamental_result") and state["fundamental_result"].get("company"):
            company_name = state["fundamental_result"]["company"].get("name")

        market = state.get("market", "NSE")
        articles = fetch_news_for_ticker(ticker.split(".")[0], company_name, market=market)

        if not articles:
            state["news_status"] = "unavailable"
            state["news_result"] = {
                "status": "unavailable",
                "reason": "No relevant news articles found for this ticker",
            }
            return state

        classified_articles = _analyze_sentiment_with_ollama(articles)

        sentiments = [a["sentiment"] for a in classified_articles]
        positive_count = sentiments.count("positive")
        negative_count = sentiments.count("negative")
        neutral_count = sentiments.count("neutral")
        total = len(sentiments)

        if positive_count > negative_count and positive_count > neutral_count:
            overall_sentiment = "Positive"
        elif negative_count > positive_count and negative_count > neutral_count:
            overall_sentiment = "Negative"
        else:
            overall_sentiment = "Neutral/Mixed"

        for a in classified_articles:
            if "source_url" not in a and "url" in a:
                a["source_url"] = a["url"]

        result = {
            "status": "completed",
            "articles_analyzed": total,
            "total_articles": total,
            "overall_sentiment": overall_sentiment,
            "sentiment_breakdown": {
                "positive": positive_count,
                "negative": negative_count,
                "neutral": neutral_count,
            },
            "articles": classified_articles,
            "disclaimer": "News sentiment is based on article content and may not reflect actual market impact.",
        }

        state["news_result"] = result
        state["news_status"] = "completed"

        for article in classified_articles[:5]:
            state["sources"].append({
                "source_type": "news",
                "title": article["title"],
                "source_url": article["url"],
                "published_at": article.get("published_at"),
            })

    except Exception as e:
        state["news_status"] = "failed"
        state["news_result"] = {"status": "failed", "error": str(e)}
        state["errors"].append(f"News agent error: {str(e)}")

    return state
