# Graph RAG Knowledge Assistant

A graph-enhanced RAG system for querying financial filings using entity extraction, Neo4j graph traversal, and LLM-guided multi-hop retrieval.

## Architecture

```
Next.js (TypeScript) → FastAPI + LangGraph → Neo4j Aura + Supabase
                                ↓
                     OpenAI / Gemini / OpenRouter
                                ↓
                        Langfuse + RAGAS
```

**Frontend:** Next.js + TypeScript (Vercel)
**Backend:** FastAPI + LangGraph (Render)
**Graph DB:** Neo4j Aura Free
**Storage:** Supabase Free
**LLM:** OpenAI (primary) with Gemini/OpenRouter free-tier fallback
**Observability:** Langfuse Cloud
**Evaluation:** RAGAS

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (optional, for local Neo4j)

### Backend

```bash
cd backend
cp .env.example .env
# Fill in your API keys in .env

pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### Docker (full stack)

```bash
docker-compose up
```

## LLM Provider Strategy

The system defaults to free-tier LLMs (Gemini Flash or OpenRouter) and switches to OpenAI when a valid `OPENAI_API_KEY` is configured. This allows zero-cost development and demo usage.

| Provider | Model | Cost | When Used |
|----------|-------|------|-----------|
| OpenAI | gpt-4.1-nano | Paid | When `OPENAI_API_KEY` is set |
| Gemini | gemini-2.5-flash | Free | Default fallback |
| OpenRouter | deepseek-r1 | Free | Alternative fallback |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app
│   │   ├── config.py          # Settings + env
│   │   ├── api/routes.py      # REST endpoints
│   │   ├── llm/provider.py    # LLM factory with fallback
│   │   ├── graph/             # Neo4j client + entity ops
│   │   ├── rag/workflow.py    # LangGraph RAG pipeline
│   │   ├── observability/     # Langfuse integration
│   │   └── evaluation/        # RAGAS eval harness
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   ├── components/        # React components
│   │   └── lib/api.ts         # Backend API client
│   └── package.json
├── docker-compose.yml
└── README.md
```
