# Multi-Agent Stock Research Analyst: Architecture & Engineering Design

Based on the architecture diagram and project roadmap, this design document details the system design, data flows, mathematical models, and implementation specifications for **Milestone 2 (Financial Tools & Individual Agents)** and **Milestone 3 (Supervisor Orchestration & Report Generation)**.

---

## 1. End-to-End System Blueprint

```mermaid
flowchart TD
    subgraph Client["Presentation Layer (React 18 + TypeScript + Tailwind)"]
        UI_Search["Stock Search (NSE / BSE)"]
        UI_Chart["Interactive Charts (Plotly Candlesticks + Indicators)"]
        UI_Dash["Agent Execution Monitor"]
        UI_Report["Research Report Viewer (Markdown / PDF Export)"]
    end

    subgraph API_Layer["Backend Gateway (FastAPI)"]
        Auth_JWT["JWT Authentication Guard"]
        REST_Stocks["/api/stocks (Data & Watchlist)"]
        REST_Research["/api/research (Task & Workflow Lifecycle)"]
    end

    subgraph LangGraph_Orchestrator["Multi-Agent System (LangGraph)"]
        Supervisor["Supervisor Agent (Coordinator & State Guard)"]
        
        subgraph Milestone2_Agents["Milestone 2: Specialized Research Agents"]
            direction TB
            Agent_Fund["Fundamental Analysis Agent\n(P/E, P/B, ROE, Margins, Debt)"]
            Agent_Tech["Technical Analysis Agent\n(SMA, EMA, RSI, MACD, Volatility)"]
            Agent_News["News & Sentiment Agent\n(RSS + Ollama / Offline Fallback)"]
            Agent_Risk["Risk Analysis Agent\n(Max Drawdown, VaR, Conflict Engine)"]
        end

        subgraph Milestone3_Agents["Milestone 3: Report Synthesis"]
            Agent_Report["Report Generation Agent\n(Consolidation, Provenance, Limitations)"]
        end
    end

    subgraph Storage["Persistence Layer (PostgreSQL / SQLite)"]
        DB_Users[("users")]
        DB_Tasks[("research_tasks")]
        DB_Results[("agent_results")]
        DB_Docs[("source_documents")]
        DB_Reports[("research_reports")]
        DB_Saved[("saved_stocks")]
    end

    subgraph External["External Data Sources"]
        Feed_Market["Yahoo Finance / curl_cffi (OHLCV & Prices)"]
        Feed_Financials["Company Statements (Income, Balance, Cash Flow)"]
        Feed_RSS["Indian Financial RSS (ET, Mint, BS)"]
        LLM_Local["Local Ollama Engine (qwen2.5:7b)"]
    end

    %% Client to API
    Client <-->|REST + Bearer Token| API_Layer

    %% API to Orchestration & Storage
    REST_Stocks <--> Storage
    REST_Research -->|Trigger Task| Supervisor
    Supervisor <--> Storage

    %% Supervisor Routing
    Supervisor --> Agent_Fund
    Supervisor --> Agent_Tech
    Supervisor --> Agent_News
    Agent_Fund --> Agent_Risk
    Agent_Tech --> Agent_Risk
    Agent_News --> Agent_Risk
    Agent_Risk --> Agent_Report
    Agent_Report --> Storage

    %% Agents to External Feeds
    Agent_Fund <--> Feed_Financials
    Agent_Tech <--> Feed_Market
    Agent_News <--> Feed_RSS
    Agent_News <--> LLM_Local
    Agent_Report <--> LLM_Local
```

---

## 2. Milestone 2: Financial Analysis Tools & Individual Agents

Milestone 2 focuses on creating the four domain-specific research agents. Each agent operates with strict typed inputs and outputs, deterministic fallbacks, and zero data fabrication.

```mermaid
flowchart LR
    subgraph Inputs["Standardized Inputs"]
        Inp_Ticker["Ticker Symbol (e.g. RELIANCE)"]
        Inp_Market["Exchange (NSE or BSE)"]
        Inp_Period["Timeframe (1mo, 6mo, 1y)"]
    end

    subgraph M2_Agents["Specialist Processing"]
        direction TB
        F["1. Fundamental Agent\n• P/E, P/B, EV/EBITDA\n• Operating & Net Margin\n• Debt-to-Equity & Current Ratio"]
        T["2. Technical Agent\n• SMA 20, 50, 200\n• EMA 12, 26, 50\n• 14-Day RSI & MACD (12,26,9)\n• 20-Day Annualized Volatility"]
        N["3. News & Sentiment Agent\n• Multi-Feed RSS Ingestion\n• Ollama Sentiment & Categorization\n• Offline Keyword Scoring Fallback\n• Published Timestamps & Source URLs"]
        R["4. Risk Analysis Agent\n• Maximum Drawdown (%)\n• 1-Day 95% Parametric VaR\n• Beta & Downside Volatility\n• Cross-Signal Contradiction Detection"]
    end

    subgraph Outputs["Enriched State Output"]
        Out_Fund["fundamental_result JSON"]
        Out_Tech["technical_result JSON"]
        Out_News["news_result JSON"]
        Out_Risk["risk_result + conflicts JSON"]
    end

    Inputs --> F --> Out_Fund
    Inputs --> T --> Out_Tech
    Inputs --> N --> Out_News
    Out_Fund & Out_Tech & Out_News --> R --> Out_Risk
```

### 2.1. Mathematical & Algorithmic Specifications

#### A. Fundamental Analysis Formulations
* **Valuation Multiples**:
  $$\text{P/E Ratio} = \frac{\text{Current Market Price}}{\text{Earnings Per Share (EPS)}}, \quad \text{P/B Ratio} = \frac{\text{Current Market Price}}{\text{Book Value Per Share}}$$
* **Profitability Margins**:
  $$\text{Operating Margin} = \left(\frac{\text{Operating Income}}{\text{Total Revenue}}\right) \times 100$$
  $$\text{Net Profit Margin} = \left(\frac{\text{Net Income}}{\text{Total Revenue}}\right) \times 100, \quad \text{ROE} = \left(\frac{\text{Net Income}}{\text{Shareholders' Equity}}\right) \times 100$$
* **Solvency & Gearing**:
  $$\text{Debt-to-Equity} = \frac{\text{Total Debt}}{\text{Total Equity}}, \quad \text{Current Ratio} = \frac{\text{Current Assets}}{\text{Current Liabilities}}$$

#### B. Technical Analysis Formulations
* **Simple Moving Average (SMA)**:
  $$\text{SMA}_n(t) = \frac{1}{n}\sum_{i=0}^{n-1} P_{t-i}$$
* **Exponential Moving Average (EMA)**:
  $$\text{EMA}_t = P_t \cdot \alpha + \text{EMA}_{t-1} \cdot (1 - \alpha), \quad \alpha = \frac{2}{n + 1}$$
* **Relative Strength Index (RSI - 14 Days)**:
  $$\text{RSI} = 100 - \frac{100}{1 + \text{RS}}, \quad \text{RS} = \frac{\text{Smoothed Gain}_{14}}{\text{Smoothed Loss}_{14}}$$
  * *Zero Loss Condition*: If average loss $= 0$ in an uninterrupted uptrend, $\text{RSI} = 100.0$.
* **Moving Average Convergence Divergence (MACD 12, 26, 9)**:
  $$\text{MACD Line} = \text{EMA}_{12}(P) - \text{EMA}_{26}(P)$$
  $$\text{Signal Line} = \text{EMA}_9(\text{MACD Line})$$
  $$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$
* **Annualized Historical Volatility**:
  $$\sigma_{\text{ann}} = \sqrt{252} \cdot \sqrt{\frac{1}{N-1}\sum_{i=1}^N (r_i - \bar{r})^2} \times 100, \quad r_i = \ln\left(\frac{P_i}{P_{i-1}}\right)$$

#### C. News & Sentiment Scoring Engine
* **Ollama Structured Extraction**: Prompt formatted to return strict JSON schema:
  `{"sentiment": "positive|negative|neutral", "category": "earnings|regulatory|deal|general", "reason": "..."}`.
* **Deterministic Fallback Lexicon**: Token-matching financial keyword scoring prevents failure if Ollama is unreachable.
* **Data Provenance**: Every headline records its publisher domain, published UTC timestamp, and canonical article URL.

#### D. Risk Analysis & Cross-Signal Contradiction Engine
* **Maximum Drawdown (MDD)**:
  $$\text{MDD} = \min_{t \in [0, T]} \left(\frac{P_t - \max_{\tau \le t} P_\tau}{\max_{\tau \le t} P_\tau}\right) \times 100$$
* **Value at Risk (Parametric 95% 1-Day VaR)**:
  $$\text{VaR}_{95\%} = 1.645 \cdot \sigma_{\text{daily}} \times 100$$
* **Cross-Agent Contradiction Detection Rules**:
  1. *Rule 1*: Technical signal is `Bullish`, but Fundamental Net Profit Margin is negative ($< 0$).
  2. *Rule 2*: Technical RSI indicates Overbought ($> 70$), while Fundamental P/E is elevated ($> 50$).
  3. *Rule 3*: Technical momentum is `Bullish`, but recent News Sentiment is predominantly `Negative`.

---

## 3. Milestone 3: Supervisor Agent & Report Generation

Milestone 3 orchestrates the research workflow using **LangGraph**, providing bounded retries, error recovery, and consolidated report synthesis.

```mermaid
stateDiagram-v2
    [*] --> Supervisor_Init: User Triggers Research Task
    
    Supervisor_Init --> Validate_Ticker: Check Symbol & Market Suffix
    
    Validate_Ticker --> Parallel_Specialists: Input Valid
    Validate_Ticker --> Task_Failed: Invalid Symbol or Exchange

    state Parallel_Specialists {
        [*] --> Run_Fundamental
        [*] --> Run_Technical
        [*] --> Run_News
        
        Run_Fundamental --> Complete_Fundamental
        Run_Technical --> Complete_Technical
        Run_News --> Complete_News
    }

    Parallel_Specialists --> Run_Risk: All 3 Specialist Branches Complete
    
    state Run_Risk {
        Calculate_Drawdown --> Calculate_VaR
        Calculate_VaR --> Evaluate_Cross_Agent_Conflicts
    }

    Run_Risk --> Report_Generator: Risk Evaluated & Conflicts Flagged
    
    state Report_Generator {
        Synthesize_Sections --> Highlight_Discrepancies
        Highlight_Discrepancies --> Append_Source_Citations
        Append_Source_Citations --> Define_Data_Limitations
    }

    Report_Generator --> Persist_Database: Save Report & Results to PostgreSQL
    Persist_Database --> [*]: Task Marked Completed (UI Refreshes)
```

### 3.1. Supervisor Orchestration Components

1. **State Machine (`ResearchState`)**:
   * Shared graph context tracking execution status (`pending`, `running`, `completed`, `failed`, `unavailable`) for every node.
   * State updates are immutable and append-only across nodes.

2. **Conditional Routing & Resilient Retries**:
   * If an agent fails (e.g., Yahoo Finance rate limits or network timeout), the Supervisor retries up to 2 times with exponential backoff.
   * If retries are exhausted, the agent state is flagged as `unavailable` with a documented reason, allowing downstream nodes to continue without crashing the workflow.

3. **Report Generation Agent**:
   * Uses local Ollama (`qwen2.5:7b`) with temperature $0.2$ to synthesize outputs into an institutional research report.
   * **Mandatory Sections in Final Report**:
     * **Executive Summary**: Investment thesis and composite sentiment.
     * **Fundamental Health Overview**: Capital structure, valuation multiples, and profitability analysis.
     * **Technical Setup**: Key moving averages, momentum oscillator status, and support/resistance zones.
     * **News & Catalyst Timeline**: Chronological headline digest with sentiment classifications.
     * **Risk Factors & Contradictions**: Highlighted discrepancies detected by the Risk Agent.
     * **Data Provenance & Audit Trail**: Footnotes referencing all URLs and retrieval timestamps.
     * **Limitations & Disclaimers**: Explicit note that calculations are historical and not financial advice.

4. **Persistence Layer Updates**:
   * Synchronizes task progress to PostgreSQL / SQLite:
     * `research_tasks` updated with status and completion timestamps.
     * `agent_results` stores individual agent JSON outputs.
     * `source_documents` tracks ingested links and content hashes.
     * `research_reports` stores the final Markdown document for rendering and PDF generation.

---

## 4. Database Entity Relationships (Milestones 2 & 3)

```mermaid
erDiagram
    users ||--o{ research_tasks : "creates"
    users ||--o{ saved_stocks : "bookmarks"
    research_tasks ||--o{ agent_results : "produces"
    research_tasks ||--o{ source_documents : "cites"
    research_tasks ||--|| research_reports : "generates"

    users {
        string user_id PK
        string email
        string password_hash
        string full_name
        datetime created_at
    }

    research_tasks {
        string task_id PK
        string user_id FK
        string ticker
        string market
        string requested_period
        string status
        datetime created_at
        datetime completed_at
    }

    agent_results {
        string result_id PK
        string task_id FK
        string agent_name
        string status
        json output_json
        text error_message
        datetime created_at
    }

    source_documents {
        string source_id PK
        string task_id FK
        string source_type
        string title
        string source_url
        datetime published_at
        datetime retrieved_at
    }

    research_reports {
        string report_id PK
        string task_id FK
        text report_content
        text summary
        text limitations
        datetime created_at
    }

    saved_stocks {
        string saved_stock_id PK
        string user_id FK
        string ticker
        string market
        datetime created_at
    }
```

---

## 5. Implementation Roadmap & Verification Plan

| Phase | Milestone | Deliverable | Verification Standard |
|---|---|---|---|
| **Step 1** | M2 | Ratio & Indicator Calculators | Tested with `pytest` against known manual benchmarks (`test_technical_indicators.py`). |
| **Step 2** | M2 | Fundamental & Technical Agents | Verifies data parsing, division-by-zero safety, and `unavailable` flagging. |
| **Step 3** | M2 | News & Sentiment Agent | RSS fetching validated across ET and LiveMint feeds with offline fallback. |
| **Step 4** | M2 | Risk Analysis Agent | Maximum Drawdown and conflict rules tested against synthetic contradictory data. |
| **Step 5** | M3 | LangGraph Supervisor | Validates state transitions, parallel branch merging, and retry policies. |
| **Step 6** | M3 | Report Generation Agent | Markdown generation with audit footnotes and PDF export capability. |
| **Step 7** | M3 | End-to-End Orchestration | Full pipeline execution tested across 3 diverse equities on NSE and BSE. |
