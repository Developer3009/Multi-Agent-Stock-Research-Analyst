"""Tests for authentication endpoints."""
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db


@pytest_asyncio.fixture
async def client():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_register_new_user(client: AsyncClient):
    """Registering a new user should return 201 with user data."""
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = await client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "securepassword123"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == unique_email
    assert "user_id" in data
    assert "password_hash" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Registering with an already-used email should return 400."""
    email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "password123"
    })
    res = await client.post("/api/auth/register", json={
        "email": email,
        "password": "differentpassword"
    })
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_login_valid_credentials(client: AsyncClient):
    """Login with valid credentials should return a JWT token."""
    email = f"login_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "mypassword"
    })
    res = await client.post("/api/auth/login", json={
        "email": email,
        "password": "mypassword"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Login with wrong password should return 401."""
    email = f"wrong_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "correctpass"
    })
    res = await client.post("/api/auth/login", json={
        "email": email,
        "password": "wrongpass"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient):
    """Authenticated /me endpoint should return user info."""
    email = f"me_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "password"
    })
    login = await client.post("/api/auth/login", json={
        "email": email,
        "password": "password"
    })
    token = login.json()["access_token"]
    res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == email



@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    """Unauthenticated /me endpoint should return 401."""
    res = await client.get("/api/auth/me")
    assert res.status_code == 401
