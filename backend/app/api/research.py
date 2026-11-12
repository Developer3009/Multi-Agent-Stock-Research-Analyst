from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.database import get_db
from app.core.security import get_current_user
from app.models.db_models import User, ResearchTask, AgentResult, SourceDocument, ResearchReport
from app.models.schemas import ResearchRequest, ResearchTaskOut, FullResearchOut
from typing import List

router = APIRouter(prefix="/api/research", tags=["research"])


async def _persist_results(db: AsyncSession, task_id: str, final_state: dict):
    result = await db.execute(select(ResearchTask).where(ResearchTask.task_id == task_id))
    task = result.scalar_one_or_none()
    if task:
        task.status = "completed"
        task.completed_at = datetime.utcnow()

    agent_map = {
        "fundamental": ("fundamental_result", "fundamental_status"),
        "technical": ("technical_result", "technical_status"),
        "news": ("news_result", "news_status"),
        "risk": ("risk_result", "risk_status"),
    }

    for agent_name, (result_key, status_key) in agent_map.items():
        agent_result = AgentResult(
            task_id=task_id,
            agent_name=agent_name,
            status=final_state.get(status_key, "failed"),
            output_json=final_state.get(result_key),
            error_message=None,
        )
        db.add(agent_result)

    for src in final_state.get("sources", []):
        source = SourceDocument(
            task_id=task_id,
            source_type=src.get("source_type", "unknown"),
            title=src.get("title"),
            source_url=src.get("source_url"),
            published_at=None,
        )
        db.add(source)

    if final_state.get("report_content"):
        report = ResearchReport(
            task_id=task_id,
            report_content=final_state.get("report_content"),
            summary=final_state.get("report_summary"),
            limitations=final_state.get("report_limitations"),
        )
        db.add(report)

    await db.commit()


async def _run_and_persist(task_id: str, ticker: str, market: str, period: str, _db_url: str):
    from app.database import AsyncSessionLocal
    from app.agents.supervisor import run_research_workflow

    async with AsyncSessionLocal() as db:
        try:
            final_state = await run_research_workflow(task_id, ticker, market, period)
            await _persist_results(db, task_id, final_state)
        except Exception:
            result = await db.execute(select(ResearchTask).where(ResearchTask.task_id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = "failed"
                task.completed_at = datetime.utcnow()
            await db.commit()


@router.post("/start", response_model=ResearchTaskOut)
async def start_research(
    payload: ResearchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = ResearchTask(
        user_id=current_user.user_id,
        ticker=payload.ticker.upper(),
        market=payload.market.upper(),
        requested_period=payload.period,
        status="running",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    background_tasks.add_task(
        _run_and_persist,
        task.task_id,
        payload.ticker,
        payload.market,
        payload.period,
        "",
    )
    return task


@router.get("/status/{task_id}", response_model=ResearchTaskOut)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResearchTask).where(
            ResearchTask.task_id == task_id,
            ResearchTask.user_id == current_user.user_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/history/all", response_model=List[ResearchTaskOut])
async def get_research_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResearchTask)
        .where(ResearchTask.user_id == current_user.user_id)
        .order_by(ResearchTask.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/{task_id}", response_model=FullResearchOut)
async def get_research_result(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResearchTask).where(
            ResearchTask.task_id == task_id,
            ResearchTask.user_id == current_user.user_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    agents_result = await db.execute(
        select(AgentResult).where(AgentResult.task_id == task_id)
    )
    agent_results = agents_result.scalars().all()

    report_result = await db.execute(
        select(ResearchReport).where(ResearchReport.task_id == task_id)
    )
    report = report_result.scalar_one_or_none()

    return FullResearchOut(task=task, agent_results=agent_results, report=report)
