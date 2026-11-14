import sys
import uuid
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_login_flow(email: str, password: str, full_name: str, run_num: int):
    print(f"\n==========================================")
    print(f"[Run {run_num}] Testing User Flow: Register & Login ({email})")
    print(f"==========================================")
    
    # 1. Register new user
    reg_resp = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
        timeout=10,
    )
    assert reg_resp.status_code in (200, 201, 400), f"Registration returned {reg_resp.status_code}: {reg_resp.text}"
    print(f"  ✓ Registration stage passed for {email}")

    # 2. Login with valid credentials
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    assert login_resp.status_code == 200, f"Expected 200 login, got {login_resp.status_code}: {login_resp.text}"
    login_data = login_resp.json()
    assert "access_token" in login_data, "Missing access_token in response"
    token = login_data["access_token"]
    print(f"  ✓ Login succeeded! Access token received (length: {len(token)})")

    # 3. Verify /me endpoint with token
    me_resp = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert me_resp.status_code == 200, f"Expected 200 /me, got {me_resp.status_code}: {me_resp.text}"
    user_info = me_resp.json()
    assert user_info["email"] == email, f"Expected email {email}, got {user_info['email']}"
    print(f"  ✓ Verified identity via /api/auth/me: {user_info['full_name']} ({user_info['email']})")
    print(f"  ✓ [Run {run_num}] PASSED successfully!\n")

def test_negative_and_demo_flow(run_num: int):
    print(f"\n==========================================")
    print(f"[Run {run_num}] Testing Negative Credential Check & Demo Flow")
    print(f"==========================================")
    
    # Negative test: invalid password
    bad_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "trader@example.com", "password": "WrongPassword999!"},
        timeout=10,
    )
    assert bad_resp.status_code == 401, f"Expected 401 for bad password, got {bad_resp.status_code}"
    print("  ✓ Correctly rejected invalid password with 401 Unauthorized")

    # Positive demo login
    demo_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "trader@example.com", "password": "Password123!"},
        timeout=10,
    )
    assert demo_resp.status_code == 200, f"Demo login failed: {demo_resp.status_code}"
    token = demo_resp.json()["access_token"]
    print(f"  ✓ Demo trader login succeeded (token length {len(token)})")
    print(f"  ✓ [Run {run_num}] PASSED successfully!\n")

def main():
    print("Beginning 3 E2E test runs for Login/Auth flows with distinct data...")
    uid1 = str(uuid.uuid4())[:8]
    uid2 = str(uuid.uuid4())[:8]

    # Run 1: Unique User Alpha
    test_login_flow(f"alpha_{uid1}@investor.com", "AlphaSecret123!", "Alpha Capital", 1)

    # Run 2: Unique User Beta
    test_login_flow(f"beta_{uid2}@quanthedge.org", "BetaSecret456!", "Beta Quant Research", 2)

    # Run 3: Negative validation & Demo flow
    test_negative_and_demo_flow(3)

    print("🎉 ALL 3 DISTINCT E2E AUTHENTICATION FLOWS PASSED (100%)!")

if __name__ == "__main__":
    main()
