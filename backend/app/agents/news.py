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
    """Use Ollama to classify sentiment for each article."""
    try:
        llm = ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0,
        )

        classified = []
        for article in articles[:10]:
            prompt = f"""Classify the sentiment of this financial news article as exactly one of: positive, negative, or neutral.
Also identify if it relates to: earnings, acquisition, regulatory, management_change, product_launch, or other.

Title: {article['title']}
Summary: {article['summary'][:300]}

Respond in JSON format only:
{{"sentiment": "positive|negative|neutral", "category": "earnings|acquisition|regulatory|management_change|product_launch|other", "reason": "one sentence explanation"}}"""

            try:
                response = llm.invoke([HumanMessage(content=prompt)])
                content = response.content.strip()
                if "{" in content:
                    json_str = content[content.find("{"):content.rfind("}") + 1]
                    parsed = json.loads(json_str)
                    article["sentiment"] = parsed.get("sentiment", "neutral")
                    article["category"] = parsed.get("category", "other")
                    article["sentiment_reason"] = parsed.get("reason", "")
                else:
                    raise ValueError("No JSON in response")
            except Exception:
                article["sentiment"] = _classify_sentiment_local(
                    article["title"], article["summary"]
                )
                article["category"] = "other"
                article["sentiment_reason"] = "Classified using keyword analysis"

            classified.append(article)

        for article in articles[10:]:
            article["sentiment"] = _classify_sentiment_local(article["title"], article["summary"])
            article["category"] = "other"
            article["sentiment_reason"] = "Classified using keyword analysis"
            classified.append(article)

        return classified

    except Exception:
        for article in articles:
            article["sentiment"] = _classify_sentiment_local(article["title"], article["summary"])
            article["category"] = "other"
            article["sentiment_reason"] = "Classified using keyword analysis (Ollama unavailable)"
        return articles


def news_agent(state: ResearchState) -> ResearchState:
    """News & Sentiment Agent."""
    ticker = state["ticker"]

    try:
        company_name = None
        if state.get("fundamental_result") and state["fundamental_result"].get("company"):
            company_name = state["fundamental_result"]["company"].get("name")

        articles = fetch_news_for_ticker(ticker.split(".")[0], company_name)

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
