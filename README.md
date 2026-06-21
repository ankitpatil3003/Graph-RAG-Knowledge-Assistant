# Graph RAG Knowledge Assistant

A graph-enhanced RAG system for querying financial filings. Uses LLM-powered entity extraction, Neo4j graph traversal, and multi-hop retrieval to answer complex questions across documents — with a built-in evaluation harness comparing chunking strategies and retrieval methods.

## Key Results

- **+38% multi-hop recall** — graph-enhanced retrieval vs dense-only (chunk-only) baseline, measured across 15 ground-truth financial queries
- **3 chunking strategies compared** — fixed, semantic, and late chunking evaluated across faithfulness, context recall, and answer relevancy
- **Full pipeline observability** — every LLM call, entity extraction, and retrieval step traced in Langfuse

## Architecture

```
                  ┌─────────────────────────────────────────────┐
                  │              Next.js Frontend               │
                  │   Landing · Chat · Graph Viz · Eval Panel   │
                  └──────────────────┬──────────────────────────┘
                                     │ REST API
                  ┌──────────────────┴──────────────────────────┐
                  │              FastAPI Backend                 │
                  │                                             │
                  │  ┌────────── LangGraph Workflow ──────────┐ │
                  │  │ Extract Entities → Graph Retrieval →   │ │
                  │  │ Chunk Retrieval → Generate Answer      │ │
                  │  └────────────────────────────────────────┘ │
                  │                                             │
                  │  Ingestion: PDF → Chunk → Extract → Graph   │
                  │  Eval: Benchmark + Chunking Comparison      │
                  └───┬──────────┬──────────────┬───────────────┘
                      │          │              │
                 Neo4j Aura   Langfuse     OpenAI / Gemini
                 (Graph DB)   (Traces)     (LLM Provider)
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15 + TypeScript | Dark-themed UI with chat, graph viz, eval dashboard |
| Backend | FastAPI + Python 3.12 | REST API, ingestion pipeline |
| Orchestration | LangGraph | 4-node RAG workflow (extract → graph → chunks → generate) |
| Graph DB | Neo4j Aura Free | Entity/relationship storage, multi-hop traversal |
| LLM | OpenAI (primary) / Gemini Flash (free fallback) | Entity extraction, answer generation, evaluation |
| Observability | Langfuse Cloud | Tracing on all workflow nodes |
| Evaluation | Token-overlap scoring + LLM-as-judge | Chunking comparison + retrieval benchmark |

## Features

### RAG Pipeline
- **PDF Ingestion** — upload financial filings, extract text with pdfplumber, chunk with 3 strategies
- **Entity Extraction** — LLM-powered extraction of companies, people, metrics, dates, locations, products, regulations
- **Graph Construction** — entities and relationships written to Neo4j with deduplication
- **Multi-hop Retrieval** — entity-based graph traversal with 2-hop neighborhood expansion + keyword fallback
- **Answer Generation** — context from graph triples + document chunks, traced via Langfuse

### Evaluation
- **Graph vs Dense Benchmark** — compares graph-enhanced retrieval (entities + neighbors + chunks) against chunk-only retrieval, proving the multi-hop recall improvement
- **Chunking Strategy Comparison** — evaluates fixed, semantic, and late chunking across faithfulness, context recall, and answer relevancy using token-overlap scoring
- **15 ground-truth Q&A pairs** across 3 financial documents, including cross-document multi-hop questions

### Frontend
- **Landing page** — animated hero with feature cards and tech stack overview
- **Chat interface** — query financial filings with real-time LLM responses, provider info display
- **Knowledge graph visualization** — force-directed canvas rendering with zoom/pan, color-coded node types, hover tooltips
- **Evaluation dashboard** — run benchmarks and chunking comparisons, per-question drill-down

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Neo4j Aura Free account
- Gemini API key (free) or OpenAI API key

### Backend

```bash
cd backend
python -m venv env
source env/bin/activate  # Windows: env\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in: GEMINI_API_KEY, NEO4J_URI, NEO4J_PASSWORD, LANGFUSE keys

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

### Docker (full stack)

```bash
docker-compose up
```

## LLM Provider Strategy

Zero-cost by default. The system uses free-tier LLMs and switches to OpenAI when configured.

| Provider | Model | Cost | When Used |
|----------|-------|------|-----------|
| OpenAI | gpt-4.1-nano | Paid | When `OPENAI_API_KEY` is set |
| Gemini | gemini-2.5-flash | Free | Default fallback |
| OpenRouter | deepseek-r1 | Free | Alternative fallback |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/query` | RAG query through LangGraph workflow |
| POST | `/api/ingest` | Upload and ingest a PDF filing |
| GET | `/api/graph` | Get nodes/edges for visualization |
| GET | `/api/health` | Service health check |
| POST | `/api/evaluate` | Run chunking strategy evaluation |
| POST | `/api/benchmark` | Run graph-vs-dense retrieval benchmark |
| GET | `/api/provider` | Current LLM provider info |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app with lifespan
│   │   ├── config.py                # Pydantic Settings
│   │   ├── api/routes.py            # All REST endpoints
│   │   ├── llm/provider.py          # LLM factory with fallback chain
│   │   ├── graph/
│   │   │   ├── neo4j_client.py      # Async Neo4j driver
│   │   │   ├── entities.py          # LLM entity extraction
│   │   │   └── ingestion.py         # Graph write operations
│   │   ├── rag/
│   │   │   ├── workflow.py          # LangGraph 4-node pipeline
│   │   │   └── chunking.py          # Fixed/semantic/late strategies
│   │   ├── ingestion/
│   │   │   ├── pdf_parser.py        # pdfplumber text extraction
│   │   │   └── pipeline.py          # End-to-end ingestion orchestration
│   │   ├── evaluation/
│   │   │   ├── eval_dataset.py      # 15 ground-truth Q&A pairs
│   │   │   ├── ragas_eval.py        # Chunking strategy comparison
│   │   │   └── benchmark.py         # Graph vs dense retrieval benchmark
│   │   └── observability/
│   │       └── langfuse_client.py   # Langfuse v3 integration
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Landing page + app layout
│   │   │   ├── layout.tsx           # Root layout
│   │   │   └── globals.css          # Dark theme + animations
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx        # Chat interface
│   │   │   ├── FileUpload.tsx       # PDF upload with strategy selector
│   │   │   ├── GraphVisualization.tsx # Force-directed graph with zoom/pan
│   │   │   ├── EvalDashboard.tsx    # Benchmark + chunking eval UI
│   │   │   └── StatusBar.tsx        # Service connection status
│   │   └── lib/api.ts              # Typed API client
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Deployment

| Service | Platform | Tier |
|---------|----------|------|
| Frontend | Vercel | Free |
| Backend | Render | Free |
| Graph DB | Neo4j Aura | Free |
| Observability | Langfuse Cloud | Free |
