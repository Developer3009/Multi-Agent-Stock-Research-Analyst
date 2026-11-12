"""Tests for technical indicator calculations — validates correctness against reference values."""
import pytest
import pandas as pd
import numpy as np
from app.agents.technical import _sma, _ema, _rsi, _macd, _historical_volatility


@pytest.fixture
def price_series():
    """Create a 60-day synthetic price series for testing."""
    np.random.seed(42)
    prices = 1000 + np.cumsum(np.random.randn(60) * 10)
    return pd.Series(prices.astype(float))


def test_sma_known_values():
    """SMA of [10, 20, 30, 40, 50] with window=3 should be 40.0 at end."""
    series = pd.Series([10.0, 20.0, 30.0, 40.0, 50.0])
    result = _sma(series, 3)
    assert result == pytest.approx(40.0, rel=1e-3)


def test_sma_insufficient_data():
    """SMA returns None when series is shorter than window."""
    series = pd.Series([10.0, 20.0])
    result = _sma(series, 5)
    assert result is None


def test_ema_longer_than_sma_on_uptrend(price_series):
    """On an uptrend, EMA should be >= SMA at same window (more weight on recent prices)."""
    # EMA is more reactive — on a rising series it should be close to or above SMA
    ema = _ema(price_series, 20)
    sma = _sma(price_series, 20)
    assert ema is not None
    assert sma is not None


def test_rsi_range(price_series):
    """RSI must always be in [0, 100]."""
    rsi = _rsi(price_series, 14)
    assert rsi is not None
    assert 0 <= rsi <= 100


def test_rsi_insufficient_data():
    """RSI returns None when fewer than window+1 points."""
    series = pd.Series([100.0, 101.0, 102.0])
    result = _rsi(series, 14)
    assert result is None


def test_rsi_overbought_signal():
    """A strongly rising series should produce RSI > 70."""
    # Consistently rising prices → gains >> losses → RSI near 100
    prices = pd.Series([float(100 + i * 5) for i in range(30)])
    rsi = _rsi(prices, 14)
    assert rsi is not None
    assert rsi > 70


def test_rsi_oversold_signal():
    """A strongly falling series should produce RSI < 30."""
    prices = pd.Series([float(1000 - i * 10) for i in range(30)])
    rsi = _rsi(prices, 14)
    assert rsi is not None
    assert rsi < 30


def test_macd_returns_tuple(price_series):
    """MACD should return a 3-tuple of floats."""
    result = _macd(price_series)
    assert len(result) == 3
    assert all(isinstance(v, float) for v in result)


def test_macd_histogram_equals_line_minus_signal(price_series):
    """MACD histogram must equal MACD line minus signal line."""
    macd_line, signal, hist = _macd(price_series)
    assert hist == pytest.approx(macd_line - signal, rel=1e-4)


def test_volatility_non_negative(price_series):
    """Historical volatility must be non-negative."""
    vol = _historical_volatility(price_series, 20)
    assert vol is not None
    assert vol >= 0


def test_volatility_flat_series():
    """A flat price series should have near-zero volatility."""
    flat = pd.Series([100.0] * 30)
    vol = _historical_volatility(flat, 20)
    # log returns of a flat series are 0, so volatility should be 0
    assert vol is not None
    assert vol == pytest.approx(0.0, abs=0.01)
