from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.db_models import User
from app.models.schemas import UserCreate, UserLogin, Token, UserOut, SocialAuthRequest
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone=user_in.phone,
        password_hash=get_password_hash(user_in.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/social-login", response_model=Token)
async def social_login(payload: SocialAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate or register seamlessly via Google, Facebook, or Apple."""
    provider = payload.provider.lower()
    email = payload.email or f"{provider}_user_{uuid.uuid4().hex[:6]}@stockresearch.ai"
    full_name = payload.full_name or f"{provider.capitalize()} Trader"

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        # Create user account for social sign-in
        random_pass = str(uuid.uuid4())
        user = User(
            email=email,
            full_name=full_name,
            phone=payload.phone,
            password_hash=get_password_hash(random_pass),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token({"sub": user.user_id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login(form: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with JSON credentials and receive a JWT access token."""
    result = await db.execute(select(User).where(User.email == form.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user.user_id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/token", response_model=Token)
async def login_form(
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2-compatible form-based login (username = email)."""
    result = await db.execute(select(User).where(User.email == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.user_id})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return current_user
