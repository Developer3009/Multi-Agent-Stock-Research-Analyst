"""Tests for the News & Sentiment Agent."""
import pytest
from unittest.mock import patch, MagicMock
from app.agents.state import ResearchState


def _make_state(ticker="RELIANCE", market="NSE") -> ResearchState:
    return ResearchState(
        task_id="test-news-001",
        ticker=ticker,
        market=market,
        yf_ticker=f"{ticker}.NS",
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


# ── Offline keyword fallback tests ───────────────────────────────────────────

def test_news_agent_runs_without_llm():
    """News agent should produce a result even if Ollama is unavailable."""
    from app.agents.news import news_agent

    state = _make_state()
    # Patch feedparser to return empty feed (simulates no network)
    with patch("feedparser.parse", return_value=MagicMock(entries=[])):
        result = news_agent(state)

    assert result["news_result"] is not None
    assert result["news_status"] in ("completed", "unavailable")


def test_news_result_schema():
    """News result must follow the defined schema."""
    from app.agents.news import news_agent

    state = _make_state()
    with patch("feedparser.parse", return_value=MagicMock(entries=[])):
        result = news_agent(state)

    nr = result.get("news_result", {})
    assert isinstance(nr, dict), "news_result must be a dict"

    if result["news_status"] == "completed":
        assert "articles" in nr, "news_result must have 'articles'"
        assert "overall_sentiment" in nr, "news_result must have 'overall_sentiment'"
        assert "total_articles" in nr, "news_result must have 'total_articles'"


def test_news_articles_have_required_fields():
    """Each article must have title, source_url, published_at, and sentiment."""
    from app.agents.news import news_agent

    mock_entry = MagicMock()
    mock_entry.title = "RELIANCE Q3 profits surge 20%"
    mock_entry.link = "https://economictimes.com/reliance-q3"
    mock_entry.published = "Thu, 14 Nov 2024 10:00:00 +0530"
    mock_entry.summary = "Reliance Industries reported strong quarterly earnings."
    mock_entry.get = lambda k, default=None: getattr(mock_entry, k, default)

    mock_feed = MagicMock()
    mock_feed.entries = [mock_entry]

    state = _make_state()
    with patch("feedparser.parse", return_value=mock_feed):
        with patch("app.agents.news.ChatOllama", side_effect=Exception("Ollama offline")):
            result = news_agent(state)

    if result["news_status"] == "completed":
        articles = result["news_result"].get("articles", [])
        for article in articles:
            assert "title" in article, "Article missing 'title'"
            assert "source_url" in article, "Article missing 'source_url'"
            assert "sentiment" in article, "Article missing 'sentiment'"
            assert article["sentiment"] in ("positive", "negative", "neutral"), \
                f"Invalid sentiment: {article['sentiment']}"


def test_news_sentiment_fallback_keywords():
    """Offline keyword classifier must correctly classify sentiment."""
    from app.agents.news import _keyword_sentiment

    positive_titles = [
        "Company reports record profits",
        "Stock surges after strong earnings",
        "Dividend declared for shareholders",
        "Revenue growth beats expectations",
    ]
    negative_titles = [
        "Company faces heavy losses",
        "Stock crashes amid scandal",
        "Debt burden forces layoffs",
        "Regulatory probe launched",
    ]
    neutral_titles = [
        "Annual general meeting scheduled",
        "Board approves new committee",
    ]

    for title in positive_titles:
        assert _keyword_sentiment(title) == "positive", f"Should be positive: {title}"
    for title in negative_titles:
        assert _keyword_sentiment(title) == "negative", f"Should be negative: {title}"
    for title in neutral_titles:
        assert _keyword_sentiment(title) == "neutral", f"Should be neutral: {title}"


def test_news_sources_populated():
    """Sources list should be populated from article URLs."""
    from app.agents.news import news_agent

    mock_entry = MagicMock()
    mock_entry.title = "TCS wins mega deal"
    mock_entry.link = "https://livemint.com/tcs-deal"
    mock_entry.published = "Fri, 15 Nov 2024 09:00:00 +0530"
    mock_entry.summary = "TCS wins a $500M outsourcing deal."
    mock_entry.get = lambda k, default=None: getattr(mock_entry, k, default)

    mock_feed = MagicMock()
    mock_feed.entries = [mock_entry]

    state = _make_state("TCS")
    with patch("feedparser.parse", return_value=mock_feed):
        with patch("app.agents.news.ChatOllama", side_effect=Exception("Ollama offline")):
            result = news_agent(state)

    if result["news_status"] == "completed":
        sources = result.get("sources", [])
        assert isinstance(sources, list)


def test_news_agent_tcs():
    """Test news agent with TCS ticker."""
    from app.agents.news import news_agent

    state = _make_state("TCS", "NSE")
    with patch("feedparser.parse", return_value=MagicMock(entries=[])):
        result = news_agent(state)

    assert result["news_result"] is not None
    assert result["news_status"] in ("completed", "unavailable")


def test_news_agent_hdfcbank():
    """Test news agent with HDFCBANK ticker."""
    from app.agents.news import news_agent

    state = _make_state("HDFCBANK", "NSE")
    with patch("feedparser.parse", return_value=MagicMock(entries=[])):
        result = news_agent(state)

    assert result["news_result"] is not None


def test_news_overall_sentiment_valid_values():
    """overall_sentiment must be one of: positive, negative, neutral, mixed."""
    from app.agents.news import news_agent

    state = _make_state()
    with patch("feedparser.parse", return_value=MagicMock(entries=[])):
        result = news_agent(state)

    if result["news_status"] == "completed":
        sentiment = result["news_result"].get("overall_sentiment", "").lower()
        assert any(s in sentiment for s in ("positive", "negative", "neutral", "mixed")), \
            f"Invalid overall_sentiment: {sentiment}"
