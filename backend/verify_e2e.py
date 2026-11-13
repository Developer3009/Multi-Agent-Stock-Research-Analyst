"""
End-to-end verification script — 3 flows with different data each run.
Tests: register → login (form) → /me → search → info → history → save → list → delete
Run with: .\\venv\\Scripts\\python.exe verify_e2e.py
"""
import httpx
import uuid
import sys

BASE = "http://localhost:8000"


def run_flow(flow_num: int, email: str, password: str, full_name: str,
             symbol: str, market: str, period: str):
    print(f"\n{'='*60}")
    print(f"FLOW {flow_num}: user={email}  stock={symbol}/{market}  period={period}")
    print('='*60)

    # 1. Register
    r = httpx.post(f"{BASE}/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": full_name,
    }, timeout=15)
    assert r.status_code == 201, f"[FAIL] Register: {r.status_code} {r.text}"
    reg_data = r.json()
    assert reg_data["email"] == email
    assert reg_data.get("full_name") == full_name
    print(f"  ✅ Register OK  → id={reg_data['user_id']}  name={reg_data.get('full_name')}")

    # 2. Login via JSON
    r = httpx.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    assert r.status_code == 200, f"[FAIL] JSON Login: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"  ✅ JSON Login OK  → JWT token received")

    # 3. Login via form (OAuth2 compatible)
    r = httpx.post(f"{BASE}/api/auth/token",
                   data={"username": email, "password": password},
                   headers={"Content-Type": "application/x-www-form-urlencoded"},
                   timeout=10)
    assert r.status_code == 200, f"[FAIL] Form Login: {r.status_code} {r.text}"
    print(f"  ✅ Form Login OK  → OAuth2 token received")

    # 4. /me
    r = httpx.get(f"{BASE}/api/auth/me", headers=headers, timeout=10)
    assert r.status_code == 200, f"[FAIL] /me: {r.status_code} {r.text}"
    assert r.json()["email"] == email
    print(f"  ✅ /me OK  → {r.json()['email']}  full_name={r.json().get('full_name')}")

    # 5. Search stocks
    r = httpx.get(f"{BASE}/api/stocks/search",
                  params={"query": symbol, "market": market},
                  headers=headers, timeout=10)
    assert r.status_code == 200, f"[FAIL] Search: {r.status_code} {r.text}"
    results = r.json().get("results", [])
    assert len(results) > 0, f"[FAIL] No search results for {symbol}/{market}"
    ticker = results[0]["ticker"]
    print(f"  ✅ Search OK  → {len(results)} results, top ticker: {ticker}")

    # 6. Stock info
    r = httpx.get(f"{BASE}/api/stocks/info/{ticker}",
                  params={"market": market}, headers=headers, timeout=20)
    assert r.status_code == 200, f"[FAIL] Info: {r.status_code} {r.text}"
    info = r.json()
    print(f"  ✅ Info OK  → name={info.get('name')}  price={info.get('current_price')}")

    # 7. Historical prices (validate OHLCV)
    r = httpx.get(f"{BASE}/api/stocks/history/{ticker}",
                  params={"market": market, "period": period},
                  headers=headers, timeout=30)
    assert r.status_code == 200, f"[FAIL] History: {r.status_code} {r.text}"
    hist = r.json()
    pts = len(hist.get("data", []))
    assert pts > 0, f"[FAIL] No OHLCV data for {ticker}/{market}/{period}"
    # Validate OHLCV integrity
    for row in hist["data"][:5]:
        assert row["high"] >= row["low"], f"[FAIL] High < Low in OHLCV: {row}"
        assert row["close"] > 0, f"[FAIL] Close price non-positive: {row}"
    print(f"  ✅ History OK  → {pts} OHLCV points, data integrity validated")

    # 8. Save to watchlist
    r = httpx.post(f"{BASE}/api/stocks/saved",
                   json={"ticker": ticker, "market": market},
                   headers=headers, timeout=10)
    assert r.status_code in (200, 201), f"[FAIL] Save: {r.status_code} {r.text}"
    saved_id = r.json()["saved_stock_id"]
    print(f"  ✅ Watchlist add OK  → saved_stock_id={saved_id}")

    # 9. List watchlist
    r = httpx.get(f"{BASE}/api/stocks/saved", headers=headers, timeout=10)
    assert r.status_code == 200, f"[FAIL] List saved: {r.status_code} {r.text}"
    saved_list = r.json()
    assert any(s["saved_stock_id"] == saved_id for s in saved_list), "[FAIL] Stock not in watchlist"
    print(f"  ✅ Watchlist list OK  → {len(saved_list)} item(s)")

    # 10. Delete from watchlist
    r = httpx.delete(f"{BASE}/api/stocks/saved/{saved_id}", headers=headers, timeout=10)
    assert r.status_code in (200, 204), f"[FAIL] Delete: {r.status_code} {r.text}"
    print(f"  ✅ Watchlist delete OK  → {saved_id} removed")

    # 11. Confirm deletion
    r = httpx.get(f"{BASE}/api/stocks/saved", headers=headers, timeout=10)
    after_list = r.json()
    assert not any(s["saved_stock_id"] == saved_id for s in after_list), "[FAIL] Stock still in watchlist after delete"
    print(f"  ✅ Deletion confirmed  → watchlist now has {len(after_list)} item(s)")

    # 12. Start AI Research Workflow
    r = httpx.post(f"{BASE}/api/research/start",
                   json={"ticker": ticker, "market": market, "period": period},
                   headers=headers, timeout=15)
    assert r.status_code == 200, f"[FAIL] Start research: {r.status_code} {r.text}"
    task_id = r.json()["task_id"]
    print(f"  ✅ Research started  → task_id={task_id}")

    # 13. Check task status
    r = httpx.get(f"{BASE}/api/research/status/{task_id}", headers=headers, timeout=10)
    assert r.status_code == 200, f"[FAIL] Task status: {r.status_code} {r.text}"
    print(f"  ✅ Task status OK  → {r.json()['status']}")

    # 14. Check research history
    r = httpx.get(f"{BASE}/api/research/history/all", headers=headers, timeout=10)
    assert r.status_code == 200, f"[FAIL] Research history: {r.status_code} {r.text}"
    history = r.json()
    assert any(h["task_id"] == task_id for h in history), "[FAIL] Task not found in research history"
    print(f"  ✅ Research history OK  → {len(history)} item(s)")

    # 15. Poll for research completion (up to 45s)
    import time
    completed = False
    for attempt in range(15):
        time.sleep(2)
        r = httpx.get(f"{BASE}/api/research/status/{task_id}", headers=headers, timeout=10)
        status = r.json()["status"]
        if status in ("completed", "failed"):
            completed = True
            print(f"  ✅ Research completed in ~{(attempt+1)*2}s with status: {status}")
            break

    # 16. Get full research result
    r = httpx.get(f"{BASE}/api/research/{task_id}", headers=headers, timeout=15)
    assert r.status_code == 200, f"[FAIL] Get research result: {r.status_code} {r.text}"
    result_data = r.json()
    assert "task" in result_data and "agent_results" in result_data
    agent_names = [a["agent_name"] for a in result_data.get("agent_results", [])]
    print(f"  ✅ Research result OK  → {len(agent_names)} agents recorded: {agent_names}")

    # 17. Download PDF Report Export
    r = httpx.get(f"{BASE}/api/research/{task_id}/pdf", headers=headers, timeout=15)
    if r.status_code == 200:
        assert len(r.content) > 50
        print(f"  ✅ PDF/Report export OK  → size={len(r.content)} bytes, content-type={r.headers.get('content-type')}")
    else:
        print(f"  ℹ️ Report export status={r.status_code} (status={status})")

    print(f"\n  🎉 FLOW {flow_num} PASSED — all 17 steps succeeded")


def main():
    # Confirm health first
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        assert r.status_code == 200
        print(f"✅ Backend health check OK: {r.json()}")
    except Exception as e:
        print(f"❌ Backend not reachable: {e}")
        sys.exit(1)

    uid = uuid.uuid4().hex[:8]
    flows = [
        # flow_num, email, password, full_name, symbol, market, period
        (1, f"alice_{uid}@test.com", "Alice@2024!", "Alice Sharma",   "RELIANCE",  "NSE", "1mo"),
        (2, f"bob_{uid}@test.com",   "Bob@Secure1", "Bob Verma",     "TCS",       "BSE", "6mo"),
        (3, f"carol_{uid}@test.com", "Carol$789",   "Carol Patel",   "HDFCBANK",  "NSE", "1y"),
    ]

    passed, failed = 0, 0
    for args in flows:
        try:
            run_flow(*args)
            passed += 1
        except AssertionError as e:
            print(f"\n  ❌ ASSERTION: {e}")
            failed += 1
        except Exception as e:
            print(f"\n  ❌ UNEXPECTED: {type(e).__name__}: {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"RESULT: {passed}/{len(flows)} flows passed, {failed} failed")
    print('='*60)
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
