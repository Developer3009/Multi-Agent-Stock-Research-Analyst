"""
News service using free RSS feeds from Indian financial publications.
No API key required.
"""
import feedparser
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime
import re


RSS_FEEDS = {
    "economic_times": "https://economictimes.indiatimes.com/markets/stocks/rss.cms",
    "livemint": "https://www.livemint.com/rss/markets",
    "business_standard": "https://www.business-standard.com/rss/markets-106.rss",
    "moneycontrol": "https://www.moneycontrol.com/rss/marketreports.xml",
}


def _clean_html(raw: str) -> str:
    """Strip HTML tags from text."""
    if not raw:
        return ""
    clean = re.compile("<.*?>")
    return re.sub(clean, "", raw).strip()


def _hash_content(content: str) -> str:
    return hashlib.md5(content.encode()).hexdigest()


def fetch_news_for_ticker(ticker: str, company_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch relevant news articles from RSS feeds for a given ticker/company.
    Returns list of articles with title, url, summary, published_at, source.
    """
    search_terms = [ticker.upper().split(".")[0]]  # remove .NS/.BO suffix
    if company_name:
        words = company_name.split()
        if words:
            search_terms.append(words[0].upper())

    articles = []

    for source_name, feed_url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:30]:  # check latest 30 entries per feed
                title = entry.get("title", "")
                summary = _clean_html(entry.get("summary", entry.get("description", "")))
                link = entry.get("link", "")
                published = entry.get("published", "")

                pub_date = None
                try:
                    if entry.get("published_parsed"):
                        pub_date = datetime(*entry.published_parsed[:6]).isoformat()
                except Exception:
                    pass

                text_to_search = (title + " " + summary).upper()
                if any(term in text_to_search for term in search_terms):
                    articles.append({
                        "title": title,
                        "url": link,
                        "summary": summary[:500],
                        "published_at": pub_date or published,
                        "source": source_name.replace("_", " ").title(),
                        "content_hash": _hash_content(title + link),
                    })
        except Exception:
            continue

    # Deduplicate by content_hash
    seen = set()
    unique_articles = []
    for article in articles:
        h = article["content_hash"]
        if h not in seen:
            seen.add(h)
            unique_articles.append(article)

    return unique_articles[:20]


_live_news_cache: Dict[str, Dict[str, Any]] = {}


def get_live_news(ticker: Optional[str] = None, company_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch live real-time financial news from RSS feeds.
    Cached for 60 seconds so minute-by-minute auto-refresh stays fast and resilient.
    """
    cache_key = (ticker or "ALL").upper()
    now = datetime.utcnow().timestamp()

    if cache_key in _live_news_cache:
        cached = _live_news_cache[cache_key]
        if now - cached.get("_cached_at", 0) < 60:
            return cached["data"]

    # 1. Fetch ticker-specific news if ticker provided
    articles = []
    if ticker:
        articles = fetch_news_for_ticker(ticker, company_name)

    # 2. If fewer than 5 articles found, supplement with top market headlines
    if len(articles) < 5:
        existing_hashes = {a["content_hash"] for a in articles}
        for source_name, feed_url in RSS_FEEDS.items():
            try:
                feed = feedparser.parse(feed_url)
                for entry in feed.entries[:10]:
                    title = entry.get("title", "")
                    link = entry.get("link", "")
                    h = _hash_content(title + link)
                    if h not in existing_hashes:
                        existing_hashes.add(h)
                        summary = _clean_html(entry.get("summary", entry.get("description", "")))
                        pub_date = None
                        try:
                            if entry.get("published_parsed"):
                                pub_date = datetime(*entry.published_parsed[:6]).isoformat()
                        except Exception:
                            pass
                        articles.append({
                            "title": title,
                            "url": link,
                            "summary": summary[:400],
                            "published_at": pub_date or entry.get("published", ""),
                            "source": source_name.replace("_", " ").title(),
                            "content_hash": h,
                        })
                    if len(articles) >= 15:
                        break
            except Exception:
                continue

    # 3. Add sentiment analysis to live feed
    from app.agents.news import _classify_sentiment_local
    for a in articles:
        a["sentiment"] = _classify_sentiment_local(a["title"], a.get("summary", ""))

    _live_news_cache[cache_key] = {"data": articles[:20], "_cached_at": now}
    return articles[:20]
