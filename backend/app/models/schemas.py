from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Stock Search ───────────────────────────────────────────────────────
class StockSearchRequest(BaseModel):
    query: str
    market: str = "NSE"  # NSE or BSE


class StockInfo(BaseModel):
    ticker: str
    name: str
    market: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    currency: Optional[str] = None
    exchange: Optional[str] = None


class OHLCVPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class HistoricalData(BaseModel):
    ticker: str
    market: str
    period: str
    data: List[OHLCVPoint]


# ── Research ───────────────────────────────────────────────────────────
class ResearchRequest(BaseModel):
    ticker: str
    market: str = "NSE"  # NSE or BSE
    period: str = "1y"


class ResearchTaskOut(BaseModel):
    task_id: str
    ticker: str
    market: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AgentResultOut(BaseModel):
    result_id: str
    agent_name: str
    status: str
    output_json: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    report_id: str
    task_id: str
    report_content: Optional[str] = None
    summary: Optional[str] = None
    limitations: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FullResearchOut(BaseModel):
    task: ResearchTaskOut
    agent_results: List[AgentResultOut]
    report: Optional[ReportOut] = None


# ── Saved Stocks ───────────────────────────────────────────────────────
class SavedStockCreate(BaseModel):
    ticker: str
    market: str = "NSE"


class SavedStockOut(BaseModel):
    saved_stock_id: str
    ticker: str
    market: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Agent Internal Schemas ─────────────────────────────────────────────
class AgentOutput(BaseModel):
    agent_name: str
    status: str  # completed | failed | unavailable
    data: Optional[Dict[str, Any]] = None
    sources: List[Dict[str, Any]] = []
    error: Optional[str] = None
