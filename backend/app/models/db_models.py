import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    research_tasks = relationship("ResearchTask", back_populates="user", cascade="all, delete-orphan")
    saved_stocks = relationship("SavedStock", back_populates="user", cascade="all, delete-orphan")


class ResearchTask(Base):
    __tablename__ = "research_tasks"

    task_id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    ticker = Column(String, nullable=False)
    market = Column(String, nullable=False)  # NSE or BSE
    requested_period = Column(String, default="1y")
    status = Column(String, default="pending")  # pending | running | completed | failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="research_tasks")
    agent_results = relationship("AgentResult", back_populates="task", cascade="all, delete-orphan")
    source_documents = relationship("SourceDocument", back_populates="task", cascade="all, delete-orphan")
    report = relationship("ResearchReport", back_populates="task", uselist=False, cascade="all, delete-orphan")


class AgentResult(Base):
    __tablename__ = "agent_results"

    result_id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("research_tasks.task_id"), nullable=False, index=True)
    agent_name = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending | running | completed | failed | unavailable
    output_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("ResearchTask", back_populates="agent_results")


class SourceDocument(Base):
    __tablename__ = "source_documents"

    source_id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("research_tasks.task_id"), nullable=False, index=True)
    source_type = Column(String, nullable=False)  # news | financial_data | company_profile
    title = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    published_at = Column(DateTime, nullable=True)
    retrieved_at = Column(DateTime, default=datetime.utcnow)
    content_hash = Column(String, nullable=True)

    task = relationship("ResearchTask", back_populates="source_documents")


class ResearchReport(Base):
    __tablename__ = "research_reports"

    report_id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("research_tasks.task_id"), nullable=False, unique=True)
    report_content = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    limitations = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("ResearchTask", back_populates="report")


class SavedStock(Base):
    __tablename__ = "saved_stocks"

    saved_stock_id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    ticker = Column(String, nullable=False)
    market = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="saved_stocks")
