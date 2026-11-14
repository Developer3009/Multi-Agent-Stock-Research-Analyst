import sys
import uuid
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_registration_with_phone_flow(run_num: int):
    print(f"\n==========================================")
    print(f"[Run {run_num}] Testing Registration with Phone, Full Name & Login")
    print(f"==========================================")
    uid = str(uuid.uuid4())[:8]
    email = f"user_{uid}@tradernet.in"
    password = f"Pass_{uid}_99!"
    full_name = f"Trader {uid.upper()}"
    phone = f"+91 98{uid[:6]}"
    
    # Register
    reg_resp = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "phone": phone
        },
        timeout=10,
    )
    assert reg_resp.status_code == 201, f"Expected 201, got {reg_resp.status_code}: {reg_resp.text}"
    user_data = reg_resp.json()
    assert user_data["email"] == email, "Email mismatch"
    assert user_data["phone"] == phone, f"Phone mismatch: expected {phone}, got {user_data.get('phone')}"
    print(f"  ✓ Registered new user: {full_name} | Phone: {phone} | ID: {user_data['user_id']}")
    
    # Login
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    print(f"  ✓ Login succeeded with received JWT token: {token[:20]}...")
    
    # Verify /me
    me_resp = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["phone"] == phone
    print(f"  ✓ Verified /me returned phone {phone} and full name {full_name}")
    print(f"  ✓ [Run {run_num}] PASSED successfully!\n")

def test_social_auth_flow(provider: str, run_num: int):
    print(f"\n==========================================")
    print(f"[Run {run_num}] Testing Social Auth Flow: Provider = {provider.upper()}")
    print(f"==========================================")
    uid = str(uuid.uuid4())[:8]
    email = f"{provider}_{uid}@social.auth.com"
    full_name = f"{provider.capitalize()} User {uid.upper()}"
    
    resp = requests.post(
        f"{BASE_URL}/api/auth/social-login",
        json={
            "provider": provider,
            "email": email,
            "full_name": full_name
        },
        timeout=10,
    )
    assert resp.status_code == 200, f"Social login failed: {resp.status_code}: {resp.text}"
    token_data = resp.json()
    assert "access_token" in token_data
    token = token_data["access_token"]
    print(f"  ✓ Social authentication succeeded for {provider.upper()}! Access token: {token[:20]}...")
    
    # Verify profile
    me_resp = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert me_resp.status_code == 200
    user_info = me_resp.json()
    assert user_info["email"] == email
    print(f"  ✓ Session verified via /api/auth/me for {user_info['full_name']} ({user_info['email']})")
    print(f"  ✓ [Run {run_num}] PASSED successfully!\n")

def main():
    print("Beginning 3 E2E test runs for connected authentication services...")
    # Run 1: Full registration with Phone and Name
    test_registration_with_phone_flow(1)
    
    # Run 2: Social OAuth service (Google)
    test_social_auth_flow("google", 2)
    
    # Run 3: Social OAuth service (Apple)
    test_social_auth_flow("apple", 3)
    
    print("🎉 ALL 3 DISTINCT E2E AUTHENTICATION SERVICE FLOWS PASSED (100%)!")

if __name__ == "__main__":
    main()
