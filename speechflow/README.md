# 🎙️ SpeechFlow

**Real-Time Multilingual Speech-to-Text Web Application**

SpeechFlow lets users speak naturally through their browser microphone and see spoken words transcribed in real time. It supports English, Hindi, Malayalam, and natural code-switching between them — no manual language selection required.

---

## Features

- 🎤 **Real-time transcription** — Interim previews while you speak, finalized text as utterances complete
- 🌐 **Multilingual** — English, Hindi (Devanagari), Malayalam, and mixed-language speech
- 🔄 **Auto language detection** — No manual language switching needed
- ⏯️ **Full recording controls** — Start, Pause, Resume, Stop
- 💾 **Automatic + Manual saving** — Transcripts persist to Supabase PostgreSQL automatically
- 📋 **CRUD Dashboard** — View, search, edit, and delete transcription history
- 🔒 **Anonymous sessions** — No login required; sessions are cookie-based
- 🐳 **Docker-ready** — Local dev with docker-compose; production on Render

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Icons | Lucide React |
| Audio | Web Audio API + AudioWorklet |
| WebSocket client | Native WebSocket API |
| Backend | FastAPI + Uvicorn |
| ORM | SQLAlchemy 2.x (async) |
| Migrations | Alembic |
| DB driver | asyncpg |
| AI | Google Gemini Live API (`google-genai`) |
| Database | Supabase PostgreSQL |
| Containers | Docker + docker-compose |
| Deployment | Render (frontend + backend) |

---

## Project Structure

```
speechflow/
├── frontend/           Next.js application
│   ├── app/            Pages (App Router)
│   ├── components/     UI components
│   ├── hooks/          Custom React hooks
│   ├── lib/            API client, WebSocket client
│   ├── types/          Shared TypeScript types
│   └── public/         Static files (AudioWorklet processor)
│
├── backend/            FastAPI application
│   ├── app/
│   │   ├── api/        REST + WebSocket endpoints
│   │   ├── core/       Config, security, logging
│   │   ├── database/   Engine, session factory
│   │   ├── models/     SQLAlchemy ORM models
│   │   ├── schemas/    Pydantic request/response schemas
│   │   ├── repositories/ Database access layer
│   │   ├── services/   Business logic (Gemini, sessions, transcriptions)
│   │   └── utils/      Errors, pagination
│   ├── alembic/        Migration scripts
│   └── tests/          pytest test suite
│
├── docs/               Architecture, API, and deployment docs
├── docker-compose.yml  Local development
└── render.yaml         Render deployment blueprint
```

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker + Docker Compose
- A [Gemini API key](https://ai.google.dev/) with Live API access
- A [Supabase](https://supabase.com/) project (free tier works)

---

## Local Development (Without Docker)

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd speechflow
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL and GEMINI_API_KEY
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Run database migrations

```bash
# (from backend/ with venv active)
alembic upgrade head
```

### 4. Start the backend

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Frontend setup

```bash
cd ../frontend
cp .env.example .env.local
# Edit .env.local — NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Local Development (With Docker)

```bash
# Build and start all services
docker compose build
docker compose up

# Stop all services
docker compose down

# Stop and remove volumes (wipes local DB)
docker compose down -v
```

Services:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Backend docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432

---

## Running Tests

```bash
cd backend
# With venv active:
pytest tests/ -v
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Local postgres |
| `GEMINI_API_KEY` | Your Gemini API key | _(required)_ |
| `GEMINI_LIVE_MODEL` | Live model name | `gemini-3.5-transcribe-live` |
| `GEMINI_API_VERSION` | API version | `v1beta` |
| `FRONTEND_ORIGIN` | CORS allowed origin | `http://localhost:3000` |
| `SESSION_COOKIE_NAME` | Cookie name | `speechflow_session` |
| `SESSION_TTL_DAYS` | Session lifetime | `30` |
| `COOKIE_SECURE` | HTTPS-only cookies | `false` (dev), `true` (prod) |
| `COOKIE_SAMESITE` | SameSite policy | `lax` (dev), `none` (prod) |
| `ENVIRONMENT` | `development` or `production` | `development` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend FastAPI URL |

---

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database → Connection string**
3. Select **Session pooler** (port 5432) for the FastAPI backend
4. Copy the URI and set it as `DATABASE_URL` in `backend/.env`
5. Run migrations: `alembic upgrade head`

> See [docs/deployment.md](docs/deployment.md) for the full deployment guide.

---

## Render Deployment

See [docs/deployment.md](docs/deployment.md) for the complete step-by-step guide.

Quick summary:
1. Push to GitHub
2. Create **Backend** Web Service on Render (Docker, `./backend`)
3. Set all backend environment variables in Render dashboard
4. Create **Frontend** Web Service on Render (Docker, `./frontend`)
5. Set `NEXT_PUBLIC_API_BASE_URL` to the backend's Render URL
6. Run `alembic upgrade head` via Render Shell or startup command

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for:
- System architecture diagram
- Gemini streaming flow
- Anonymous session flow
- Session renewal strategy

---

## Known Limitations

- **Anonymous sessions**: Clearing browser cookies makes history inaccessible (by design — no login system)
- **Gemini session duration**: Individual Gemini WebSocket sessions cap at ~10 minutes; the app handles this transparently via Session Resumption
- **Multilingual accuracy**: Code-switching accuracy depends on Gemini model capability and audio quality; not guaranteed to be perfect
- **Render free tier**: Cold starts of ~30 seconds may occur after inactivity
- **Supabase free tier**: Limited to 60 database connections by default

---

## Development Stages

| Stage | Status | Description |
|---|---|---|
| Stage 0 | ✅ Complete | Architecture planning |
| Stage 1 | ✅ Complete | Project setup & monorepo |
| Stage 2 | ✅ Complete | Database + anonymous sessions (Supabase/PostgreSQL) |
| Stage 3 | ✅ Complete | REST API endpoints & CRUD operations |
| Stage 4 | ✅ Complete | Gemini Live transcription (`gemini-3.5-transcribe-live`) |
| Stage 5 | ✅ Complete | Frontend audio + WebSocket streaming |
| Stage 6 | ✅ Complete | Dashboard + CRUD UI (`/dashboard`, `/transcriptions/[id]`) |
| Stage 7 | 🔄 In Progress | Integration + QA & live verification |
| Stage 8 | 🔄 In Progress | Docker + Render deployment readiness |
