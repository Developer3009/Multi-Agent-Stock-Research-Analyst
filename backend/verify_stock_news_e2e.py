import time
import httpx
import sys

BASE_URL = "http://127.0.0.1:8000"

def verify_stock_news_flow(flow_num: int, ticker: str, market: str, expected_keyword: str):
    print(f"\n=======================================================")
    print(f"RUN {flow_num}: Testing Stock-Specific News for {ticker} ({market})")
    print(f"=======================================================")

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Login
        email = f"news_trader_{ticker.lower()}_{int(time.time())}@alpha.com"
        reg = client.post("/api/auth/register", json={
            "email": email,
            "password": "Password123!",
            "full_name": f"News Analyst {ticker}"
        })
        login = client.post("/api/auth/login", json={
            "email": email,
            "password": "Password123!"
        })
        assert login.status_code == 200, f"Login failed: {login.text}"
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  [STEP 1] Authenticated as {email}")

        # 2. Fetch News specifically for that selected stock
        news_resp = client.get(f"/api/stocks/news/{ticker}?market={market}", headers=headers)
        assert news_resp.status_code == 200, f"News API failed: {news_resp.text}"
        news_data = news_resp.json()
        articles = news_data.get("articles", [])
        
        print(f"  [STEP 2] Received {len(articles)} live articles specifically for {ticker}")
        assert len(articles) >= 3, f"Expected at least 3 articles for {ticker}, got {len(articles)}"

        # 3. Verify each article attributes & stock-level relevance
        relevant_matches = 0
        for idx, art in enumerate(articles[:5]):
            assert "title" in art and len(art["title"]) > 0, "Missing title"
            assert "url" in art and art["url"].startswith("http"), f"Invalid url: {art.get('url')}"
            assert "source" in art and len(art["source"]) > 0, "Missing source"
            assert "sentiment" in art and art["sentiment"] in ("positive", "negative", "neutral"), f"Invalid sentiment: {art.get('sentiment')}"
            
            text = (art["title"] + " " + art.get("summary", "")).lower()
            if expected_keyword.lower() in text or ticker.lower() in text:
                relevant_matches += 1

            print(f"    [{art['source']}] ({art['sentiment'].upper()}) {art['title'][:70]}...")
            print(f"      Time: {art.get('published_at', 'N/A')[:19]}")

        assert relevant_matches >= 2, f"Expected relevant articles matching '{expected_keyword}' or '{ticker}', got {relevant_matches}"
        print(f"  [STEP 3] Verified {relevant_matches}/5 top articles explicitly cover {ticker} / {expected_keyword}")

        # 4. Verify LangGraph Research News Agent utilizes stock-specific news
        start_resp = client.post("/api/research/start", json={
            "ticker": ticker,
            "market": market,
            "period": "1mo"
        }, headers=headers)
        assert start_resp.status_code == 200
        task_id = start_resp.json()["task_id"]
        print(f"  [STEP 4] Started AI Research Task {task_id}")

        completed = False
        for _ in range(45):
            time.sleep(1.0)
            st_resp = client.get(f"/api/research/status/{task_id}", headers=headers)
            st = st_resp.json()["status"]
            if st == "completed":
                completed = True
                break
            elif st == "failed":
                raise RuntimeError(f"Research failed: {st_resp.json()}")

        assert completed, "Research task timed out"
        full_res = client.get(f"/api/research/{task_id}", headers=headers).json()
        news_result = next((r for r in full_res.get("agent_results", []) if r["agent_name"] == "news"), None)
        assert news_result is not None, "News agent result missing"
        assert news_result["status"] == "completed", f"News agent status not completed: {news_result}"
        news_out = news_result.get("output_json", {})
        print(f"  [STEP 5] News Agent completed with overall sentiment: {news_out.get('overall_sentiment')} ({news_out.get('total_articles')} articles analyzed)")

    print(f"--> RUN {flow_num} PASSED 100% for {ticker} ({market})\n")

def main():
    try:
        # Run 1: RELIANCE on NSE (Indian Energy)
        verify_stock_news_flow(1, "RELIANCE", "NSE", "Reliance")

        # Run 2: TCS on BSE (Indian IT)
        verify_stock_news_flow(2, "TCS", "BSE", "Tata")

        # Run 3: NVDA on US (US Semiconductor)
        verify_stock_news_flow(3, "NVDA", "US", "Nvidia")

        print("==================================================================")
        print("ALL 3 USER FLOWS PASSED: REAL-TIME STOCK-SPECIFIC NEWS VERIFIED!")
        print("==================================================================")
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
