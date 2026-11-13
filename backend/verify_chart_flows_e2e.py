import sys
import requests

BASE_URL = "http://127.0.0.1:8000"

def get_auth_token():
    # Login as trader
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "trader@example.com", "password": "Password123!"},
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    
    # If login failed, register and login
    requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": "trader@example.com", "password": "Password123!", "full_name": "Pro Trader"},
        timeout=10,
    )
    
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "trader@example.com", "password": "Password123!"},
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
        
    raise RuntimeError(f"Auth failed: {resp.text}")

def test_chart_data_flow(token: str, ticker: str, market: str, period: str, run_num: int):
    print(f"\n==========================================")
    print(f"[Run {run_num}] Testing Chart Flow: {ticker} ({market}) - Period: {period}")
    print(f"==========================================")
    
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/api/stocks/history/{ticker}?market={market}&period={period}"
    resp = requests.get(url, headers=headers, timeout=15)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    
    payload = resp.json()
    assert isinstance(payload, dict) and "data" in payload, f"Expected dict with 'data' key, got {payload}"
    data = payload["data"]
    assert isinstance(data, list), "Expected list of OHLCV points"
    assert len(data) > 0, f"Expected non-empty data for {ticker}"
    print(f"  ✓ Fetched {len(data)} OHLCV points for {ticker}")
    
    first = data[0]
    last = data[-1]
    for key in ['date', 'open', 'high', 'low', 'close', 'volume']:
        assert key in first, f"Missing key {key} in OHLCV point"
        
    start_price = first['close']
    latest_price = last['close']
    net_diff = latest_price - start_price
    pct_diff = (net_diff / start_price) * 100 if start_price > 0 else 0
    is_bullish = net_diff >= 0
    
    highs = [p['high'] for p in data]
    lows = [p['low'] for p in data]
    max_high = max(highs)
    min_low = min(lows)
    
    # Calculate SMA20 and Bollinger Bands simulation
    closes = [p['close'] for p in data]
    volumes = [p['volume'] for p in data]
    
    cum_vol = 0
    cum_vp = 0
    vwap_values = []
    for h, l, c, v in zip(highs, lows, closes, volumes):
        typ = (h + l + c) / 3
        cum_vol += v
        cum_vp += typ * v
        vwap_values.append(cum_vp / cum_vol if cum_vol > 0 else c)
        
    sym = "$" if market == "US" else "₹"
    print(f"  ✓ First Price: {sym}{start_price:.2f} | Latest Price: {sym}{latest_price:.2f}")
    print(f"  ✓ Net Change: {sym}{net_diff:+.2f} ({pct_diff:+.2f}%) -> {'🟢 Bullish' if is_bullish else '🔴 Bearish'}")
    print(f"  ✓ Period Range: Low {sym}{min_low:.2f} to High {sym}{max_high:.2f}")
    print(f"  ✓ Cumulative VWAP: {sym}{vwap_values[-1]:.2f}")
    print(f"  ✓ [Run {run_num}] PASSED successfully for {ticker} ({market})!\n")

def main():
    print("Beginning 3 E2E test runs with distinct stock data...")
    token = get_auth_token()
    print("  ✓ Authenticated session established.")
    
    # Run 1: NSE mega-cap
    test_chart_data_flow(token, "RELIANCE", "NSE", "1mo", 1)
    
    # Run 2: BSE IT leader
    test_chart_data_flow(token, "TCS", "BSE", "1mo", 2)
    
    # Run 3: US mega-cap tech
    test_chart_data_flow(token, "NVDA", "US", "1mo", 3)
    
    print("🎉 ALL 3 DISTINCT E2E CHART FLOWS PASSED (100%)!")

if __name__ == "__main__":
    main()
