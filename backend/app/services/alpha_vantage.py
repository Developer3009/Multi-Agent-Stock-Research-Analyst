"""
Alpha Vantage API service for real-time stock quotes and intraday data.
Uses free API Key provided by user with intelligent caching and fallback.
"""
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alphavantage.co/query"

# 60-second in-memory cache to conserve the 25 requests/day free tier while providing real-time data
_av_quote_cache: Dict[str, Dict[str, Any]] = {}


def _get_av_symbol(ticker: str, market: str) -> str:
    """Format ticker symbol for Alpha Vantage."""
    clean_ticker = ticker.upper().split(".")[0].strip()
    market_upper = market.upper()
    if market_upper in ("US", "NASDAQ", "NYSE"):
        return clean_ticker
    elif market_upper == "BSE":
        return f"{clean_ticker}.BSE"
    elif market_upper == "NSE":
        # Alpha Vantage supports Indian stocks primarily via BSE / NSE format
        return f"{clean_ticker}.BSE"
    return clean_ticker


def fetch_alpha_vantage_quote(ticker: str, market: str) -> Optional[Dict[str, Any]]:
    """
    Fetch real-time Global Quote from Alpha Vantage API.
    Returns parsed dictionary or None if rate limited / unavailable.
    """
    symbol = _get_av_symbol(ticker, market)
    now = datetime.utcnow().timestamp()

    # Check cache
    if symbol in _av_quote_cache:
        cached = _av_quote_cache[symbol]
        if now - cached.get("_cached_at", 0) < 60:
            return cached["data"]

    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": symbol,
        "apikey": settings.ALPHA_VANTAGE_API_KEY,
    }

    try:
        resp = httpx.get(BASE_URL, params=params, timeout=8.0)
        if resp.status_code == 200:
            data = resp.json()

            # Check if API rate limit or note received
            if "Global Quote" in data and data["Global Quote"]:
                gq = data["Global Quote"]
                price_str = gq.get("05. price")
                if not price_str:
                    return None

                price = round(float(price_str), 2)
                open_val = round(float(gq.get("02. open", price)), 2)
                high_val = round(float(gq.get("03. high", price)), 2)
                low_val = round(float(gq.get("04. low", price)), 2)
                prev_close = round(float(gq.get("08. previous close", price)), 2)
                change = round(float(gq.get("09. change", 0.0)), 2)

                change_pct_str = gq.get("10. change percent", "0%").replace("%", "").strip()
                try:
                    change_pct = round(float(change_pct_str), 2)
                except ValueError:
                    change_pct = 0.0

                volume_str = gq.get("06. volume", "0")
                try:
                    volume = int(volume_str)
                except ValueError:
                    volume = 0

                is_us = market.upper() in ("US", "NASDAQ", "NYSE")
                currency = "USD" if is_us else "INR"

                quote = {
                    "ticker": ticker.upper(),
                    "market": market.upper(),
                    "symbol": symbol,
                    "current_price": price,
                    "open": open_val,
                    "day_high": high_val,
                    "day_low": low_val,
                    "previous_close": prev_close,
                    "change": change,
                    "change_pct": change_pct,
                    "volume": volume,
                    "latest_trading_day": gq.get("07. latest trading day"),
                    "currency": currency,
                    "source": "Alpha Vantage API",
                    "status": "live",
                    "last_updated": datetime.utcnow().strftime("%H:%M:%S UTC"),
                }

                _av_quote_cache[symbol] = {"data": quote, "_cached_at": now}
                logger.info("Alpha Vantage live quote fetched for %s: %s %s", symbol, currency, price)
                return quote

            elif "Information" in data or "Note" in data:
                logger.warning("Alpha Vantage free tier rate limit: %s", data.get("Information") or data.get("Note"))
                return None

    except Exception as exc:
        logger.warning("Alpha Vantage request failed for %s: %s", symbol, exc)

    return None
