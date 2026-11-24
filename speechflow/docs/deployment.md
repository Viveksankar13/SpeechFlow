# SpeechFlow — Deployment Guide

## Architecture
- **Frontend**: Next.js App Router deployed on Render as a Docker Web Service.
- **Backend**: FastAPI deployed on Render as a Docker Web Service.
- **Database**: Supabase PostgreSQL with Alembic migrations.

## Step-by-Step Setup

### 1. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Settings > Database > Connection string**.
3. Under **Connection pooling**, choose **Session** (Port 5432) or **Transaction** (Port 6543).
4. Copy the connection URI:
   `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

### 2. Render Backend Web Service
1. Create a new Web Service on Render connected to your repository.
2. Root directory: `speechflow/backend`
3. Environment: `Docker`
4. Set environment variables:
   - `DATABASE_URL`: Your Supabase connection string.
   - `GEMINI_API_KEY`: Your Google AI Studio Gemini API key.
   - `GEMINI_LIVE_MODEL`: `gemini-3.5-transcribe-live`
   - `FRONTEND_ORIGIN`: Your Render frontend URL (`https://<frontend>.onrender.com`).
   - `COOKIE_SECURE`: `true`
   - `COOKIE_SAMESITE`: `none`
   - `PORT`: `8000`
   - `ENVIRONMENT`: `production`

### 3. Render Frontend Web Service
1. Create a new Web Service on Render connected to your repository.
2. Root directory: `speechflow/frontend`
3. Environment: `Docker`
4. Set build argument / environment variable:
   - `NEXT_PUBLIC_API_BASE_URL`: Your Render backend URL (`https://<backend>.onrender.com`).
   - `PORT`: `3000`

### 4. Database Migrations
Run Alembic migrations against Supabase using Render Shell or locally:
```bash
cd speechflow/backend
DATABASE_URL="<your-supabase-url>" alembic upgrade head
```
