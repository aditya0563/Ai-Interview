<div align="center">

# 🎯 Interview AI

### AI-Powered Technical Mock Interview & Code Evaluation Platform

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![tRPC](https://img.shields.io/badge/tRPC_v11-2596BE?style=for-the-badge&logo=trpc&logoColor=white)](https://trpc.io/)
[![Drizzle](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)](https://turbo.build/)
[![pnpm](https://img.shields.io/badge/pnpm_9-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Sentry](https://img.shields.io/badge/Sentry-362D59?style=for-the-badge&logo=sentry&logoColor=white)](https://sentry.io/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)

<br />

A production-grade, end-to-end **type-safe** monorepo that conducts real-time AI-driven technical interviews with live code editing, voice transcription, and intelligent follow-up — powered by **Google Gemini 1.5 Flash**.

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [Features](#-features) · [Deployment](#-deployment) · [API Reference](#-api-reference) · [Contributing](#-contributing)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🖥️ Live Coding Environment
- **Monaco Editor** — Full VS Code-like editor with syntax highlighting, IntelliSense, and TypeScript support
- **Real-time code snapshots** — Every submission captures your code for AI analysis
- **Split-screen layout** — Chat + Video on the left, Code editor on the right

</td>
<td width="50%">

### 🤖 AI Interviewer (Gemini 1.5 Flash)
- **Context-aware follow-ups** — Analyzes both conversation history and live code
- **Structured JSON output** — Reliable, parseable AI responses every time
- **Prompt injection protection** — Code is sanitized before reaching the LLM
- **Role-based interviewing** — Customizable per job role

</td>
</tr>
<tr>
<td width="50%">

### 🎙️ Voice-First Interaction
- **Web Speech API** — Browser-native speech-to-text transcription
- **Audio Visualizer** — Real-time waveform rendering via Web Audio API + Canvas
- **Hands-free mode** — Speak your answers, see them transcribed live, auto-submitted

</td>
<td width="50%">

### 🛡️ Production Security
- **Edge middleware** — Rate limiting + route shielding before Node.js runtime
- **Upstash Redis** — Sliding-window rate limiter (IP + per-user)
- **Auth.js v5** — GitHub OAuth with JWT sessions and RBAC (`user` / `admin`)
- **Input hardening** — Zod validation on every tRPC endpoint

</td>
</tr>
<tr>
<td width="50%">

### 📊 Performance Reports
- **Automated scoring** — Overall, technical, and communication scores
- **Detailed feedback** — Strengths, areas for improvement, and actionable insights
- **Persistent history** — All interviews and reports stored in PostgreSQL

</td>
<td width="50%">

### 🔍 Observability & Monitoring
- **Sentry integration** — Client, server, and edge error tracking
- **Structured logging** — JSON logs with request tracing and slow-query detection
- **tRPC middleware** — Automatic latency tracking with Sentry span capture

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                            │
│                                                                     │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐ │
│  │ Audio Input  │  │ Monaco Editor │  │    Chat Interface        │ │
│  │ (Web Speech  │  │ (Code Canvas) │  │ (tRPC React Query)       │ │
│  │  + Analyser) │  │               │  │                          │ │
│  └──────┬───────┘  └───────┬───────┘  └────────────┬─────────────┘ │
│         │                  │                       │               │
│         └──────────────────┼───────────────────────┘               │
│                            │                                       │
└────────────────────────────┼───────────────────────────────────────┘
                             │  HTTP / tRPC
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Edge Runtime (Middleware)                        │
│                                                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Auth.js Guard   │  │  IP Rate Limiter  │  │  Route Shielding │  │
│  │  (JWT Verify)    │  │  (Upstash Redis)  │  │  (API Allowlist) │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘  │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Node.js Runtime (Server)                       │
│                                                                    │
│  ┌──────────────┐  ┌───────────────────┐  ┌────────────────────┐  │
│  │  tRPC Router  │  │  Observability MW  │  │  Rate Limit MW    │  │
│  │  (interviews, │  │  (Sentry + Logger) │  │  (Per-user AI)    │  │
│  │   reports,    │  │                   │  │                    │  │
│  │   admin)      │  │                   │  │                    │  │
│  └──────┬───────┘  └───────────────────┘  └────────────────────┘  │
│         │                                                          │
│  ┌──────▼───────┐  ┌───────────────────┐                          │
│  │ Interview    │  │  Gemini 1.5 Flash  │                          │
│  │ Service      │──│  (AI Evaluation)   │                          │
│  │ (Tx Locks)   │  │                   │                          │
│  └──────┬───────┘  └───────────────────┘                          │
│         │                                                          │
└─────────┼──────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16 (Drizzle ORM)                     │
│                                                                    │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────────────┐ │
│  │  users   │ │ interviews │ │ reports  │ │ accounts / sessions │ │
│  └──────────┘ └────────────┘ └──────────┘ └─────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
interview-ai/
├── apps/
│   └── web/                              # Next.js 16 application
│       ├── src/
│       │   ├── app/                      # App Router pages & API routes
│       │   │   ├── api/auth/             #   └─ Auth.js catch-all route
│       │   │   ├── api/trpc/             #   └─ tRPC HTTP handler
│       │   │   ├── interview/            #   └─ Live interview room
│       │   │   └── page.tsx              #   └─ Landing / sign-in page
│       │   ├── components/               # AudioVisualizer, CodeCanvas (Monaco)
│       │   ├── hooks/                    # useAudioRecorder (Web Speech API)
│       │   ├── server/                   # tRPC context factory
│       │   ├── trpc/                     # Client-side tRPC + React Query setup
│       │   ├── auth.ts                   # Auth.js config (server — Drizzle adapter)
│       │   ├── auth.config.ts            # Auth.js config (edge — no Node deps)
│       │   └── proxy.ts                  # Edge middleware (rate limit + shield)
│       ├── tests/e2e/                    # Playwright end-to-end tests
│       ├── sentry.{client,server,edge}.config.ts
│       ├── server.js                     # Custom standalone production server
│       └── instrumentation.ts            # Sentry instrumentation hook
│
├── packages/
│   ├── database/                         # Drizzle ORM + PostgreSQL
│   │   └── src/
│   │       ├── schema/                   # users, interviews, reports tables
│   │       ├── client.ts                 # Database connection
│   │       └── migrate.ts               # Standalone migration runner
│   │
│   ├── trpc/                             # Shared tRPC backend
│   │   └── src/server/
│   │       ├── routers/                  # interviews, reports, admin, users
│   │       ├── services/                 # ai.ts (Gemini), interviews.ts (service layer)
│   │       ├── middleware/               # Observability middleware
│   │       └── trpc.ts                   # Procedures, auth guards, rate limiter
│   │
│   ├── logger/                           # Structured JSON logger
│   ├── ui/                               # Shared UI component library
│   └── typescript-config/                # Shared tsconfig presets
│
├── k8s/                                  # Kubernetes manifests
│   ├── web-deployment.yaml               #   └─ Web app + init migration container
│   ├── postgres-deployment.yaml          #   └─ PostgreSQL StatefulSet
│   ├── configmap-secrets.yaml            #   └─ ConfigMap & Secret templates
│   └── kustomization.yaml               #   └─ Kustomize overlay
│
├── Dockerfile                            # Multi-stage production build
├── docker-compose.yml                    # Local dev (Postgres 16 + Redis 7)
├── turbo.json                            # Turborepo pipeline config
├── .env.example                          # Environment variable template
└── package.json                          # Monorepo root scripts
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | ≥ 20 | Runtime |
| **pnpm** | ≥ 9 | Package manager |
| **Docker** | Latest | Database (PostgreSQL + Redis) |
| **Git** | Latest | Version control |

### 1. Clone & Install

```bash
git clone https://github.com/aditya0563/Ai-Interview.git
cd Ai-Interview
pnpm install
```

### 2. Environment Setup

```bash
# Copy the template
cp .env.example apps/web/.env.local
cp .env.example packages/database/.env
```

Then edit the files and fill in your credentials:

| Variable | Where to get it |
|----------|-----------------|
| `DATABASE_URL` | Pre-filled for Docker Compose (`postgresql://postgres:password@localhost:5432/interview_ai`) |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` | [GitHub OAuth Apps](https://github.com/settings/developers) — set callback to `http://localhost:3000/api/auth/callback/github` |
| `AUTH_GITHUB_SECRET` | Same GitHub OAuth App page |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `UPSTASH_REDIS_REST_URL` | [Upstash Console](https://console.upstash.com) (free tier available) |
| `UPSTASH_REDIS_REST_TOKEN` | Same Upstash dashboard |
| `NEXT_PUBLIC_SENTRY_DSN` | *(Optional)* [Sentry](https://sentry.io) — leave empty to disable |

### 3. Start the Database

```bash
docker-compose up -d
```

This spins up:
- **PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`

### 4. Push Database Schema

```bash
pnpm db:push
```

### 5. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — sign in with GitHub and enter the interview room.

---

## 🗄️ Database Schema

```mermaid
erDiagram
    users ||--o{ accounts : has
    users ||--o{ sessions : has
    users ||--o{ interviews : conducts
    interviews ||--o{ interview_messages : contains
    interviews ||--o{ interview_code_snapshots : captures
    interviews ||--o{ reports : generates

    users {
        text id PK "cuid2"
        text name
        text email UK
        timestamp email_verified
        text image
        role_enum role "user | admin"
        timestamp updated_at
        timestamp deleted_at
    }

    interviews {
        text id PK "cuid2"
        text user_id FK
        text job_role
        status_enum status "active | completed | processing | ai_failed"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    interview_messages {
        text id PK "cuid2"
        text interview_id FK
        message_role_enum role "user | assistant | system"
        text content
        timestamp created_at
    }

    interview_code_snapshots {
        text id PK "cuid2"
        text interview_id FK
        text code
        text language "default: javascript"
        timestamp created_at
    }

    reports {
        text id PK "cuid2"
        text interview_id FK
        integer overall_score
        integer technical_score
        integer communication_score
        text strengths
        text improvements
        text feedback
        timestamp created_at
    }

    accounts {
        text user_id FK
        text provider
        text provider_account_id
        text access_token
        text refresh_token
    }

    sessions {
        text session_token PK
        text user_id FK
        timestamp expires
    }
```

---

## 📡 API Reference

All API endpoints are served via **tRPC** at `/api/trpc/*`. The router is fully type-safe end-to-end.

### Interviews Router — `interviews.*`

| Procedure | Type | Auth | Rate Limited | Description |
|-----------|------|------|:------------:|-------------|
| `create` | `mutation` | ✅ | — | Create a new interview session with a job role |
| `getById` | `query` | ✅ | — | Fetch interview with messages & code snapshots |
| `addTranscriptMessage` | `mutation` | ✅ | — | Append a message to the interview transcript |
| `updateStatus` | `mutation` | ✅ | — | Transition interview status (`active` → `completed`) |
| `submitAnswer` | `mutation` | ✅ | ✅ 5/10s | Submit answer + code → Get AI follow-up response |

### Reports Router — `reports.*`

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `getByInterviewId` | `query` | ✅ | Fetch the performance report for an interview |

### Procedure Tiers

```
publicProcedure        →  No auth required
    │
protectedProcedure     →  Requires valid JWT session
    │
aiProcedure            →  Protected + Upstash rate limit (5 req / 10s per user)
    │
adminProcedure         →  Protected + role === "admin"
```

---

## 🐳 Deployment

### Docker (Standalone)

```bash
# Build the production image
docker build -t interview-ai-web .

# Run with environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e AUTH_GITHUB_ID="..." \
  -e AUTH_GITHUB_SECRET="..." \
  -e GEMINI_API_KEY="..." \
  -e UPSTASH_REDIS_REST_URL="..." \
  -e UPSTASH_REDIS_REST_TOKEN="..." \
  interview-ai-web
```

The Dockerfile uses a **multi-stage build** for minimal image size:

```
Stage 1: pruner     →  turbo prune @repo/web --docker
Stage 2: builder    →  pnpm install + turbo build
Stage 3: runner     →  Copies .next/standalone + static assets
                       Runs as non-root user (nextjs:nodejs)
```

### Kubernetes

```bash
# Apply all manifests via Kustomize
kubectl apply -k k8s/

# Or apply individually
kubectl apply -f k8s/configmap-secrets.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
```

The K8s setup includes:
- **Init container** — Runs database migrations before the app starts
- **2 replicas** — For high availability
- **Liveness & readiness probes** — Health checks on `/api/trpc/health`
- **Secrets management** — All credentials via Kubernetes Secrets (replace placeholders in `configmap-secrets.yaml`)

> ⚠️ **Important**: Update the placeholder values in `k8s/configmap-secrets.yaml` with real credentials before deploying. For production, consider using [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) or an external secret operator.

---

## 🧪 Testing

### Unit & Integration Tests

```bash
# Run all tests once
pnpm test

# Watch mode (apps/web only)
pnpm --filter @repo/web test:watch

# With coverage
pnpm --filter @repo/web vitest run --coverage
```

**Test stack**: Vitest + Testing Library + jsdom

### End-to-End Tests

```bash
# Run Playwright tests
pnpm test:e2e

# Interactive UI mode
pnpm --filter @repo/web test:e2e:ui

# Debug mode
pnpm --filter @repo/web test:e2e:debug
```

**Test stack**: Playwright

---

## 🛡️ Security Architecture

| Layer | Protection | Implementation |
|-------|-----------|----------------|
| **Edge** | IP rate limiting | Upstash Redis sliding window (100 req/10s) |
| **Edge** | Route shielding | Only `/api/auth` and `/api/trpc` allowed |
| **Edge** | Auth guard | Auth.js JWT verification on `/interview/*` and `/admin/*` |
| **Server** | Per-user AI rate limit | Upstash sliding window (5 req/10s per user ID) |
| **Server** | Input validation | Zod schemas on every tRPC procedure |
| **Server** | RBAC | Role-based access (`user` / `admin`) enforced in middleware |
| **Server** | Prompt injection defense | Code sanitization (backtick + HTML entity escaping) |
| **Database** | Concurrent write safety | `SELECT ... FOR UPDATE` row locks in transactions |
| **Container** | Least privilege | Non-root user (`nextjs:nodejs`, UID 1001) in Docker |

---

## 📜 Available Scripts

| Script | Scope | Description |
|--------|-------|-------------|
| `pnpm dev` | Monorepo | Start all dev servers via Turborepo |
| `pnpm build` | Monorepo | Production build all apps & packages |
| `pnpm lint` | Monorepo | Run ESLint across the workspace |
| `pnpm test` | Monorepo | Run unit/integration tests (Vitest) |
| `pnpm test:e2e` | Monorepo | Run end-to-end tests (Playwright) |
| `pnpm db:push` | Database | Push Drizzle schema to PostgreSQL |
| `pnpm db:studio` | Database | Open Drizzle Studio GUI |

---

## 🧰 Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | Next.js 16, React 19, Turborepo |
| **Language** | TypeScript 5 (strict mode) |
| **API Layer** | tRPC v11, TanStack React Query v5 |
| **Database** | PostgreSQL 16, Drizzle ORM |
| **Authentication** | Auth.js v5 (NextAuth), GitHub OAuth, JWT |
| **AI / LLM** | Google Gemini 1.5 Flash, Structured JSON output |
| **Rate Limiting** | Upstash Redis, `@upstash/ratelimit` |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Audio/Speech** | Web Audio API, Web Speech API, HTML5 Canvas |
| **Monitoring** | Sentry (client + server + edge), Structured logger |
| **Styling** | Tailwind CSS v4 |
| **Testing** | Vitest, Testing Library, Playwright |
| **DevOps** | Docker (multi-stage), Kubernetes, Kustomize |
| **Code Quality** | ESLint 9, Prettier, Husky, lint-staged |
| **Package Manager** | pnpm 9 workspaces |

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code refactoring |
| `docs:` | Documentation changes |
| `test:` | Adding/updating tests |
| `chore:` | Maintenance tasks |

---

## 📄 License

This project is private and not currently licensed for public distribution.

---

<div align="center">

**Built with ❤️ using Next.js, tRPC, Drizzle, and Gemini AI**

[⬆ Back to Top](#-interview-ai)

</div>
