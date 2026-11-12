from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.security import get_current_user
from app.models.db_models import User, SavedStock
from app.models.schemas import SavedStockCreate, SavedStockOut
from app.services.market_data import search_stocks, get_stock_info, get_historical_prices
from typing import List

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/search")
async def search(
    query: str = Query(..., min_length=1),
    market: str = Query("NSE", pattern="^(NSE|BSE)$"),
    current_user: User = Depends(get_current_user),
):
    results = search_stocks(query, market)
    return {"results": results, "market": market}


@router.get("/info/{ticker}")
async def stock_info(
    ticker: str,
    market: str = Query("NSE", pattern="^(NSE|BSE)$"),
    current_user: User = Depends(get_current_user),
):
    info = get_stock_info(ticker, market)
    return info


@router.get("/history/{ticker}")
async def stock_history(
    ticker: str,
    market: str = Query("NSE", pattern="^(NSE|BSE)$"),
    period: str = Query("1y"),
    current_user: User = Depends(get_current_user),
):
    df = get_historical_prices(ticker, market, period)
    if df is None:
        return {"ticker": ticker, "market": market, "data": []}

    chart_df = df.tail(500).reset_index()
    data = [
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
    return {"ticker": ticker, "market": market, "period": period, "data": data}


@router.post("/saved", response_model=SavedStockOut)
async def save_stock(
    payload: SavedStockCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    saved = SavedStock(
        user_id=current_user.user_id,
        ticker=payload.ticker.upper(),
        market=payload.market.upper(),
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return saved


@router.get("/saved", response_model=List[SavedStockOut])
async def get_saved_stocks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedStock).where(SavedStock.user_id == current_user.user_id)
    )
    return result.scalars().all()


@router.delete("/saved/{saved_stock_id}")
async def delete_saved_stock(
    saved_stock_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    result = await db.execute(
        select(SavedStock).where(
            SavedStock.saved_stock_id == saved_stock_id,
            SavedStock.user_id == current_user.user_id,
        )
    )
    saved = result.scalar_one_or_none()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved stock not found")
    await db.delete(saved)
    await db.commit()
    return {"message": "Deleted"}
