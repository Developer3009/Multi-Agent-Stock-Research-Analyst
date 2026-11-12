# 🧠 Multi-Agent Stock Research Analyst

AI-powered stock research platform for NSE & BSE using multiple specialized agents, LangGraph, and Ollama (free local LLM).

## Architecture

```
React.js Frontend ──► FastAPI Backend ──► LangGraph Supervisor
                                                ├── Fundamental Agent (yfinance)
                                                ├── Technical Agent (SMA/EMA/RSI/MACD)
                                                ├── News Agent (RSS feeds)
                                                └── Risk Agent (volatility + conflicts)
                                                         └── Report Generator (Ollama)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + Plotly |
| Backend | Python + FastAPI + Pydantic |
| AI Orchestration | LangGraph + Ollama (local, free) |
| Market Data | yfinance (NSE `.NS` / BSE `.BO`) |
| News | RSS feeds (Economic Times, LiveMint, Business Standard) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT + bcrypt |

## Prerequisites

1. **Python 3.12+**
2. **Node.js 20+**
3. **Ollama** running locally: https://ollama.ai
   ```bash
   ollama pull qwen2.5:7b   # recommended model
   # OR
   ollama pull llama3.2
   ```

## Quick Start (Development)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # Edit as needed
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Docker (Full Stack)
```bash
docker compose up --build
```
> Ollama must be running on your host machine. The backend connects to it via `host.docker.internal:11434`.

## Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_MODEL` | `qwen2.5:7b` | Any tool-calling Ollama model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DATABASE_URL` | SQLite | Use PostgreSQL URL for prod |
| `DEFAULT_MARKET` | `NSE` | NSE or BSE |
| `SECRET_KEY` | (required) | JWT signing key |

## Supported Ollama Models

| Model | Quality | Speed |
|---|---|---|
| `qwen2.5:7b` | ⭐⭐⭐⭐⭐ Recommended | Medium |
| `llama3.2:3b` | ⭐⭐⭐ | Fast |
| `mistral` | ⭐⭐⭐⭐ | Medium |
| `deepseek-r1:7b` | ⭐⭐⭐⭐⭐ | Slow |

## NSE vs BSE Toggle

The UI has a prominent **NSE | BSE toggle**. Switching changes the data source:
- NSE: `RELIANCE.NS` on Yahoo Finance
- BSE: `RELIANCE.BO` on Yahoo Finance

## Running Tests
```bash
cd backend
pytest tests/ -v
```

## Project Structure
```
multi-agent-stock-analyst/
├── backend/
│   ├── app/
│   │   ├── agents/        # LangGraph agents (fundamental, technical, news, risk, supervisor)
│   │   ├── api/           # FastAPI routes (auth, stocks, research)
│   │   ├── core/          # JWT auth, security
│   │   ├── models/        # SQLAlchemy DB models + Pydantic schemas
│   │   └── services/      # yfinance market data + RSS news
│   └── tests/             # pytest test suite
├── frontend/
│   └── src/
│       ├── components/    # MarketToggle, StockSearch, StockChart, etc.
│       ├── pages/         # Dashboard, Login, History
│       ├── hooks/         # useAuth, useMarket
│       └── api/           # Axios client
└── docker-compose.yml
```

## Disclaimer

This tool is for informational and educational purposes only. It does not constitute financial advice. Always conduct your own research before making investment decisions.
