import time
import httpx
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_test_flow(flow_num: int, ticker: str, market: str, email: str, password: str):
    print(f"\n=======================================================")
    print(f"RUN {flow_num}: Testing User Flow for {ticker} ({market})")
    print(f"=======================================================")
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Register or Login
        reg_resp = client.post("/api/auth/register", json={
            "email": email,
            "password": password,
            "full_name": f"Trader {ticker}"
        })
        login_resp = client.post("/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  [STEP 1] Authenticated successfully as {email}")

        # 2. Test Stock Info Endpoint
        info_resp = client.get(f"/api/stocks/info/{ticker}?market={market}", headers=headers)
        assert info_resp.status_code == 200, f"Info failed: {info_resp.text}"
        info = info_resp.json()
        print(f"  [STEP 2] Fetched stock info for {ticker} ({market}):")
        
        # Verify Fundamental Metrics
        required_fundamentals = ["mkt_cap", "roe", "pe_ratio", "pb_ratio", "industry_pe", "dividend_yield", "eps_ttm"]
        for key in required_fundamentals:
            val = info.get(key)
            assert val is not None, f"Missing fundamental metric '{key}' in info response: {info}"
            print(f"    - {key}: {val}")

        # Verify Company Profile & Description
        required_profile = ["ceo_or_md", "founded_in", "nse_symbol", "industry_type", "summary"]
        for key in required_profile:
            val = info.get(key)
            assert val is not None and len(str(val)) > 0, f"Missing company profile field '{key}' in info response: {info}"
            print(f"    - {key}: {val[:60]}..." if len(str(val)) > 60 else f"    - {key}: {val}")

        # 3. Test Stock History Endpoint
        hist_resp = client.get(f"/api/stocks/history/{ticker}?market={market}&period=1mo", headers=headers)
        assert hist_resp.status_code == 200, f"History failed: {hist_resp.text}"
        data_points = hist_resp.json().get("data", [])
        assert len(data_points) > 0, f"No OHLCV historical points returned for {ticker}"
        print(f"  [STEP 3] Fetched {len(data_points)} historical OHLCV points (Close: {data_points[-1]['close']})")

        # 4. Trigger Research Workflow
        start_resp = client.post("/api/research/start", json={
            "ticker": ticker,
            "market": market,
            "period": "1mo"
        }, headers=headers)
        assert start_resp.status_code == 200, f"Research start failed: {start_resp.text}"
        task_id = start_resp.json()["task_id"]
        print(f"  [STEP 4] Started Research Task {task_id}")

        # Poll until complete
        completed = False
        for _ in range(30):
            time.sleep(1.0)
            status_resp = client.get(f"/api/research/status/{task_id}", headers=headers)
            assert status_resp.status_code == 200
            st = status_resp.json()["status"]
            if st == "completed":
                completed = True
                break
            elif st == "failed":
                raise RuntimeError(f"Research task failed: {status_resp.json()}")

        assert completed, f"Research task {task_id} timed out"
        print(f"  [STEP 5] Research task completed successfully")

        # 5. Verify Fundamental Agent Output in Task Results
        full_resp = client.get(f"/api/research/{task_id}", headers=headers)
        assert full_resp.status_code == 200
        full_data = full_resp.json()
        fund_agent = next((r for r in full_data.get("agent_results", []) if r["agent_name"] == "fundamental"), None)
        assert fund_agent is not None, "Fundamental agent result not found"
        fund_out = fund_agent.get("output_json", {})
        assert "valuation" in fund_out, "Valuation not in fundamental agent output"
        assert "company" in fund_out, "Company not in fundamental agent output"
        print(f"  [STEP 6] Verified Fundamental Agent output contains valuation ratios and company leadership")

        # 6. Verify PDF Export
        pdf_resp = client.get(f"/api/research/{task_id}/pdf", headers=headers)
        assert pdf_resp.status_code == 200
        assert len(pdf_resp.content) > 500, f"PDF report response too small ({len(pdf_resp.content)} bytes)"
        print(f"  [STEP 7] Verified PDF report export ({len(pdf_resp.content)} bytes generated)")

    print(f"--> RUN {flow_num} PASSED 100% for {ticker} ({market})\n")

def main():
    try:
        # Run 1: Indian Equities NSE (RELIANCE)
        run_test_flow(1, "RELIANCE", "NSE", "e2e_flow1_rel@stockanalyst.com", "SecretPass123!")

        # Run 2: Indian Equities BSE (TCS)
        run_test_flow(2, "TCS", "BSE", "e2e_flow2_tcs@stockanalyst.com", "SecretPass123!")

        # Run 3: US Equities (NVDA)
        run_test_flow(3, "NVDA", "US", "e2e_flow3_nvda@stockanalyst.com", "SecretPass123!")

        print("=================================================================")
        print("ALL 3 USER FLOWS PASSED RIGOROUS END-TO-END VERIFICATION!")
        print("=================================================================")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
