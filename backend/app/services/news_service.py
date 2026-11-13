"""
Multi-source real-time financial news service.
Aggregates stock-specific news from:
1. Google News RSS Search (tailored specifically to the selected ticker/company)
2. Yahoo Finance RSS Ticker Wire (official ticker wire)
3. Verified Indian & Global Financial RSS Publications (The Economic Times, Mint, Business Standard, Moneycontrol)
Includes real-time sentiment analysis, publisher attribution, and strict stock-level filtering.
"""
import feedparser
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime
import re
import urllib.parse
from app.services.market_data import POPULAR_INDIAN_STOCKS, POPULAR_US_STOCKS, get_yf_ticker


COMPANY_NAME_LOOKUP = {
    # Indian Equities
    "RELIANCE": "Reliance Industries",
    "TCS": "Tata Consultancy Services",
    "INFY": "Infosys",
    "HDFCBANK": "HDFC Bank",
    "ICICIBANK": "ICICI Bank",
    "HINDUNILVR": "Hindustan Unilever",
    "ITC": "ITC Limited",
    "KOTAKBANK": "Kotak Mahindra Bank",
    "LT": "Larsen & Toubro",
    "AXISBANK": "Axis Bank",
    "BHARTIARTL": "Bharti Airtel",
    "WIPRO": "Wipro",
    "ONGC": "Oil and Natural Gas Corporation",
    "SUNPHARMA": "Sun Pharma",
    "TATAMOTORS": "Tata Motors",
    "MARUTI": "Maruti Suzuki",
    "BAJFINANCE": "Bajaj Finance",
    "ADANIENT": "Adani Enterprises",
    "SBIN": "State Bank of India",
    "POWERGRID": "Power Grid Corporation",
    # US Equities
    "NVDA": "Nvidia",
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "AMZN": "Amazon",
    "GOOGL": "Alphabet Google",
    "META": "Meta Platforms",
    "TSLA": "Tesla",
    "AVGO": "Broadcom",
    "AMD": "Advanced Micro Devices",
    "NFLX": "Netflix",
    "INTC": "Intel",
    "JPM": "JPMorgan Chase",
    "V": "Visa",
    "WMT": "Walmart",
    "DIS": "Walt Disney",
}

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


def _parse_pub_date(entry: Any) -> str:
    """Extract or parse ISO timestamp from RSS entry."""
    try:
        if getattr(entry, "published_parsed", None):
            return datetime(*entry.published_parsed[:6]).isoformat()
    except Exception:
        pass
    return getattr(entry, "published", "") or datetime.utcnow().isoformat()


def fetch_news_for_ticker(ticker: str, company_name: Optional[str] = None, market: str = "NSE") -> List[Dict[str, Any]]:
    """
    Fetch relevant news articles specifically for a given ticker and company.
    Queries Google News RSS search and Yahoo Finance ticker wire.
    Returns list of verified articles with title, url, summary, published_at, source, sentiment.
    """
    from app.agents.news import _classify_sentiment_local

    base_ticker = ticker.upper().split(".")[0].strip()
    market_upper = market.upper()
    is_us = market_upper in ("US", "NASDAQ", "NYSE")

    # Resolve company name
    if not company_name:
        company_name = COMPANY_NAME_LOOKUP.get(base_ticker)
        if not company_name:
            matched = next(
                (s["name"] for s in (POPULAR_US_STOCKS if is_us else POPULAR_INDIAN_STOCKS) if s["ticker"] == base_ticker),
                base_ticker
            )
            company_name = matched

    # Keyword search terms for strict relevance validation
    search_terms = [base_ticker.lower()]
    if company_name:
        # Add primary name tokens (ignore words like 'Ltd', 'Inc', 'Corporation', 'Limited')
        clean_name = re.sub(r"\b(ltd|limited|inc|corp|corporation|co|holdings|company)\b", "", company_name, flags=re.IGNORECASE)
        for word in clean_name.split():
            w = word.strip().lower()
            if len(w) >= 3:
                search_terms.append(w)

    articles: List[Dict[str, Any]] = []
    seen_hashes = set()
    seen_titles = set()

    def _add_article(title: str, link: str, summary: str, pub_date: str, source: str):
        if not title or not link:
            return
        # Normalize title for dedup
        norm_title = re.sub(r"[^a-zA-Z0-9]", "", title.lower())[:60]
        if norm_title in seen_titles:
            return
        h = _hash_content(title + link)
        if h in seen_hashes:
            return

        seen_hashes.add(h)
        seen_titles.add(norm_title)
        
        # Classify sentiment
        sentiment = _classify_sentiment_local(title, summary)
        articles.append({
            "title": title,
            "url": link,
            "source_url": link,
            "summary": summary[:450],
            "published_at": pub_date,
            "source": source,
            "sentiment": sentiment,
            "content_hash": h,
        })

    # ── Source 1: Google News RSS Search (Targeted specifically to this stock) ──
    try:
        query_parts = []
        if company_name and company_name != base_ticker:
            query_parts.append(f'"{company_name}" stock')
        else:
            query_parts.append(f'"{base_ticker}" stock')

        for q_str in query_parts:
            gl = "US" if is_us else "IN"
            hl = "en-US" if is_us else "en-IN"
            encoded_query = urllib.parse.quote(q_str)
            url = f"https://news.google.com/rss/search?q={encoded_query}&hl={hl}&gl={gl}&ceid={gl}:en"

            feed = feedparser.parse(url)
            for entry in feed.entries[:25]:
                raw_title = entry.get("title", "")
                link = entry.get("link", "")
                summary = _clean_html(entry.get("summary", entry.get("description", "")))
                pub_date = _parse_pub_date(entry)

                # Parse publisher name
                source = getattr(entry, "source", {}).get("title")
                title = raw_title
                if not source and " - " in raw_title:
                    parts = raw_title.rsplit(" - ", 1)
                    title = parts[0].strip()
                    source = parts[1].strip()
                if not source:
                    source = "Financial Wire"

                # Verify relevance to this specific company
                text_to_search = (title + " " + summary).lower()
                if any(term in text_to_search for term in search_terms):
                    _add_article(title, link, summary, pub_date, source)
    except Exception:
        pass

    # ── Source 2: Yahoo Finance RSS Ticker Wire ──
    try:
        yf_ticker = get_yf_ticker(base_ticker, market_upper)
        url_yf = f"https://finance.yahoo.com/rss/headline?s={yf_ticker}"
        feed_yf = feedparser.parse(url_yf)
        for entry in feed_yf.entries[:15]:
            title = entry.get("title", "")
            link = entry.get("link", "")
            summary = _clean_html(entry.get("summary", entry.get("description", "")))
            pub_date = _parse_pub_date(entry)
            _add_article(title, link, summary, pub_date, "Yahoo Finance")
    except Exception:
        pass

    # ── Source 3: Curated Indian Financial RSS (with strict matching) ──
    if not is_us and len(articles) < 15:
        for source_name, feed_url in RSS_FEEDS.items():
            try:
                feed = feedparser.parse(feed_url)
                for entry in feed.entries[:30]:
                    title = entry.get("title", "")
                    summary = _clean_html(entry.get("summary", entry.get("description", "")))
                    link = entry.get("link", "")
                    pub_date = _parse_pub_date(entry)

                    text_to_search = (title + " " + summary).lower()
                    if any(term in text_to_search for term in search_terms):
                        src_name = source_name.replace("_", " ").title()
                        _add_article(title, link, summary, pub_date, src_name)
            except Exception:
                continue

    # Sort articles by publication date descending (most recent first)
    def _sort_key(art):
        return art.get("published_at") or ""

    articles.sort(key=_sort_key, reverse=True)
    return articles[:25]


_live_news_cache: Dict[str, Dict[str, Any]] = {}


def get_live_news(
    ticker: Optional[str] = None,
    company_name: Optional[str] = None,
    market: str = "NSE"
) -> List[Dict[str, Any]]:
    """
    Fetch live real-time financial news specifically for a stock, updated by the minute.
    Cached for 45 seconds per (market, ticker) for fast, responsive live polling.
    """
    base_ticker = (ticker or "ALL").upper().split(".")[0].strip()
    market_upper = market.upper()
    cache_key = f"{market_upper}:{base_ticker}"
    now = datetime.utcnow().timestamp()

    if cache_key in _live_news_cache:
        cached = _live_news_cache[cache_key]
        if now - cached.get("_cached_at", 0) < 45:
            return cached["data"]

    # 1. Fetch 100% stock-specific news if ticker provided
    if ticker and ticker.upper() != "ALL":
        articles = fetch_news_for_ticker(base_ticker, company_name=company_name, market=market_upper)
        _live_news_cache[cache_key] = {"data": articles, "_cached_at": now}
        return articles

    # 2. If no ticker provided (General Market Home), fetch top macro headlines
    articles = []
    seen_hashes = set()
    from app.agents.news import _classify_sentiment_local

    for source_name, feed_url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:10]:
                title = entry.get("title", "")
                link = entry.get("link", "")
                h = _hash_content(title + link)
                if h not in seen_hashes:
                    seen_hashes.add(h)
                    summary = _clean_html(entry.get("summary", entry.get("description", "")))
                    pub_date = _parse_pub_date(entry)
                    articles.append({
                        "title": title,
                        "url": link,
                        "source_url": link,
                        "summary": summary[:400],
                        "published_at": pub_date,
                        "source": source_name.replace("_", " ").title(),
                        "sentiment": _classify_sentiment_local(title, summary),
                        "content_hash": h,
                    })
                if len(articles) >= 20:
                    break
        except Exception:
            continue

    _live_news_cache[cache_key] = {"data": articles[:20], "_cached_at": now}
    return articles[:20]
