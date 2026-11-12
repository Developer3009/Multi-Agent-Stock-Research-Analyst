"""Technical Analysis Agent — calculates SMA, EMA, RSI, MACD, volatility."""
import numpy as np
import pandas as pd
from typing import Optional, Dict, Any
from app.services.market_data import get_historical_prices
from app.agents.state import ResearchState


def _sma(series: pd.Series, window: int) -> Optional[float]:
    if len(series) >= window:
        return round(float(series.rolling(window).mean().iloc[-1]), 2)
    return None


def _ema(series: pd.Series, window: int) -> Optional[float]:
    if len(series) >= window:
        return round(float(series.ewm(span=window, adjust=False).mean().iloc[-1]), 2)
    return None


def _rsi(series: pd.Series, window: int = 14) -> Optional[float]:
    if len(series) < window + 1:
        return None
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = (-delta.clip(upper=0)).rolling(window).mean()
    
    last_gain = gain.iloc[-1]
    last_loss = loss.iloc[-1]

    if np.isnan(last_gain) or np.isnan(last_loss):
        return None
    if last_loss == 0:
        return 100.0 if last_gain > 0 else 50.0
    if last_gain == 0:
        return 0.0

    rs = last_gain / last_loss
    rsi = 100 - (100 / (1 + rs))
    return round(float(rsi), 2)



def _macd(series: pd.Series):
    """Returns (macd_line, signal_line, histogram) as of latest date."""
    ema12 = series.ewm(span=12, adjust=False).mean()
    ema26 = series.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal
    return (
        round(float(macd_line.iloc[-1]), 4),
        round(float(signal.iloc[-1]), 4),
        round(float(hist.iloc[-1]), 4),
    )


def _historical_volatility(series: pd.Series, window: int = 20) -> Optional[float]:
    if len(series) < window + 1:
        return None
    log_returns = np.log(series / series.shift(1)).dropna()
    vol = log_returns.rolling(window).std().iloc[-1] * np.sqrt(252) * 100
    return round(float(vol), 2)


def _trend_signal(close: pd.Series, sma20: Optional[float], sma50: Optional[float]) -> str:
    """Simple trend reading based on price vs SMAs."""
    price = close.iloc[-1]
    if sma20 and sma50:
        if price > sma20 > sma50:
            return "Bullish — price above SMA20 and SMA50"
        elif price < sma20 < sma50:
            return "Bearish — price below SMA20 and SMA50"
        else:
            return "Mixed — no clear directional trend"
    return "Insufficient data for trend determination"


def technical_agent(state: ResearchState) -> ResearchState:
    """Technical Analysis Agent."""
    ticker = state["ticker"]
    market = state["market"]
    period = state.get("period", "1y")

    try:
        df = get_historical_prices(ticker, market, period)

        if df is None or df.empty:
            state["technical_status"] = "unavailable"
            state["technical_result"] = {
                "status": "unavailable",
                "reason": "No historical price data available",
            }
            return state

        close = df["Close"]
        volume = df["Volume"]

        sma20 = _sma(close, 20)
        sma50 = _sma(close, 50)
        sma200 = _sma(close, 200)
        ema20 = _ema(close, 20)
        ema50 = _ema(close, 50)
        rsi14 = _rsi(close, 14)
        macd_line, signal_line, macd_hist = _macd(close)
        hv = _historical_volatility(close, 20)

        chart_df = df.tail(365).reset_index()
        chart_data = [
            {
                "date": str(row["Date"])[:10],
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            }
            for _, row in chart_df.iterrows()
        ]

        rsi_signal = "Neutral"
        if rsi14:
            if rsi14 > 70:
                rsi_signal = "Overbought (RSI > 70)"
            elif rsi14 < 30:
                rsi_signal = "Oversold (RSI < 30)"

        macd_signal = "Bullish" if macd_hist > 0 else "Bearish"

        result = {
            "status": "completed",
            "price_summary": {
                "current_price": round(float(close.iloc[-1]), 2),
                "period_high": round(float(close.max()), 2),
                "period_low": round(float(close.min()), 2),
                "price_change_pct": round(
                    ((close.iloc[-1] - close.iloc[0]) / close.iloc[0]) * 100, 2
                ),
            },
            "indicators": {
                "sma_20": sma20,
                "sma_50": sma50,
                "sma_200": sma200,
                "ema_20": ema20,
                "ema_50": ema50,
                "rsi_14": rsi14,
                "rsi_signal": rsi_signal,
                "macd_line": macd_line,
                "macd_signal_line": signal_line,
                "macd_histogram": macd_hist,
                "macd_signal": macd_signal,
                "historical_volatility_annualized_pct": hv,
            },
            "trend": _trend_signal(close, sma20, sma50),
            "chart_data": chart_data,
            "disclaimer": (
                "Technical indicators describe historical market conditions. "
                "They are not predictions of future performance."
            ),
        }

        state["technical_result"] = result
        state["technical_status"] = "completed"
        state["sources"].append({
            "source_type": "financial_data",
            "title": f"{ticker} Historical Prices ({market})",
            "source_url": f"https://finance.yahoo.com/quote/{state['yf_ticker']}/history",
            "published_at": None,
        })

    except Exception as e:
        state["technical_status"] = "failed"
        state["technical_result"] = {"status": "failed", "error": str(e)}
        state["errors"].append(f"Technical agent error: {str(e)}")

    return state
