from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.database import get_db
from app.core.security import get_current_user
from app.models.db_models import User, ResearchTask, AgentResult, SourceDocument, ResearchReport
from app.models.schemas import ResearchRequest, ResearchTaskOut, FullResearchOut
from typing import List
import io
import logging

logger = logging.getLogger(__name__)

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


async def _update_task_status(task_id: str, status: str):
    """Update task status in DB during workflow execution."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ResearchTask).where(ResearchTask.task_id == task_id))
        task = result.scalar_one_or_none()
        if task:
            task.status = status
            await db.commit()


async def _run_and_persist(task_id: str, ticker: str, market: str, period: str, _db_url: str):
    from app.database import AsyncSessionLocal
    from app.agents.supervisor import run_research_workflow

    async def status_callback(agent_name: str, status: str):
        """Real-time status update during workflow."""
        pass  # Task-level status is updated at start/end; agent-level in persist

    async with AsyncSessionLocal() as db:
        try:
            final_state = await run_research_workflow(
                task_id, ticker, market, period,
                status_callback=status_callback,
            )
            await _persist_results(db, task_id, final_state)
        except Exception as exc:
            logger.error("Research workflow failed for task %s: %s", task_id, exc)
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


@router.get("/{task_id}/pdf")
async def download_report_pdf(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download research report as PDF using reportlab."""
    # Verify ownership
    task_result = await db.execute(
        select(ResearchTask).where(
            ResearchTask.task_id == task_id,
            ResearchTask.user_id == current_user.user_id,
        )
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    report_result = await db.execute(
        select(ResearchReport).where(ResearchReport.task_id == task_id)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not yet generated")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
        from reportlab.lib.enums import TA_LEFT, TA_CENTER

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#1e40af"),
            spaceAfter=6,
            alignment=TA_CENTER,
        )
        subtitle_style = ParagraphStyle(
            "Subtitle",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.grey,
            alignment=TA_CENTER,
            spaceAfter=16,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=10,
            leading=16,
            spaceAfter=8,
        )
        heading_style = ParagraphStyle(
            "SectionHead",
            parent=styles["Heading2"],
            fontSize=12,
            textColor=colors.HexColor("#1e3a8a"),
            spaceBefore=12,
            spaceAfter=6,
        )

        story = []
        story.append(Paragraph(f"Stock Research Report: {task.ticker}", title_style))
        story.append(Paragraph(
            f"Market: {task.market} · Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            subtitle_style,
        ))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
        story.append(Spacer(1, 12))

        if report.summary:
            story.append(Paragraph("Executive Summary", heading_style))
            story.append(Paragraph(report.summary.replace("\n", "<br/>"), body_style))
            story.append(Spacer(1, 8))

        if report.report_content:
            story.append(Paragraph("Full Analysis", heading_style))
            for line in report.report_content.split("\n"):
                stripped = line.strip()
                if not stripped:
                    story.append(Spacer(1, 4))
                elif stripped.startswith("##"):
                    story.append(Paragraph(stripped.lstrip("#").strip(), heading_style))
                elif stripped.startswith("#"):
                    story.append(Paragraph(stripped.lstrip("#").strip(), heading_style))
                else:
                    story.append(Paragraph(stripped, body_style))

        if report.limitations:
            story.append(Spacer(1, 8))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")))
            story.append(Paragraph("Limitations & Disclaimers", heading_style))
            story.append(Paragraph(report.limitations.replace("\n", "<br/>"), body_style))

        doc.build(story)
        buffer.seek(0)

        filename = f"research_{task.ticker}_{task.market}_{task_id[:8]}.pdf"
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except ImportError:
        # reportlab not installed — return markdown instead
        md_content = f"# {task.ticker} Research Report\n\n"
        if report.summary:
            md_content += f"## Summary\n{report.summary}\n\n"
        if report.report_content:
            md_content += f"## Analysis\n{report.report_content}\n\n"
        if report.limitations:
            md_content += f"## Limitations\n{report.limitations}\n"

        filename = f"research_{task.ticker}_{task.market}_{task_id[:8]}.md"
        return StreamingResponse(
            io.BytesIO(md_content.encode()),
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
