"""Tests for market data service — validates NSE/BSE ticker formatting and data retrieval."""
import pytest
from app.services.market_data import (
    get_yf_ticker,
    search_stocks,
    MARKET_SUFFIX,
)


def test_nse_suffix():
    """NSE tickers should get .NS suffix."""
    assert get_yf_ticker("RELIANCE", "NSE") == "RELIANCE.NS"
    assert get_yf_ticker("TCS", "NSE") == "TCS.NS"
    assert get_yf_ticker("infy", "NSE") == "INFY.NS"


def test_bse_suffix():
    """BSE tickers should get .BO suffix."""
    assert get_yf_ticker("RELIANCE", "BSE") == "RELIANCE.BO"
    assert get_yf_ticker("TCS", "BSE") == "TCS.BO"
    assert get_yf_ticker("HDFCBANK", "BSE") == "HDFCBANK.BO"


def test_no_double_suffix():
    """Already-suffixed tickers should not get a second suffix."""
    assert get_yf_ticker("RELIANCE.NS", "NSE") == "RELIANCE.NS"
    assert get_yf_ticker("RELIANCE.BO", "BSE") == "RELIANCE.BO"


def test_market_suffix_map():
    """MARKET_SUFFIX must have NSE and BSE keys."""
    assert "NSE" in MARKET_SUFFIX
    assert "BSE" in MARKET_SUFFIX
    assert MARKET_SUFFIX["NSE"] == ".NS"
    assert MARKET_SUFFIX["BSE"] == ".BO"


def test_search_stocks_reliance_nse():
    """Searching RELIANCE on NSE should return results."""
    results = search_stocks("RELIANCE", "NSE")
    assert len(results) > 0
    tickers = [r["ticker"] for r in results]
    assert "RELIANCE" in tickers


def test_search_stocks_tcs_bse():
    """Searching TCS on BSE should return results with .BO suffix."""
    results = search_stocks("TCS", "BSE")
    assert len(results) > 0
    yf_tickers = [r["yf_ticker"] for r in results]
    assert any(".BO" in t for t in yf_tickers)


def test_search_stocks_case_insensitive():
    """Search should be case-insensitive."""
    results_upper = search_stocks("INFY", "NSE")
    results_lower = search_stocks("infy", "NSE")
    assert len(results_upper) > 0
    assert len(results_lower) > 0


def test_search_returns_max_10():
    """Search should return at most 10 results."""
    results = search_stocks("A", "NSE")  # broad query
    assert len(results) <= 10
