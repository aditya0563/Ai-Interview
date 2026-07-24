# Interview AI — Production-Grade Technical Mock Interview & Code Evaluation Platform

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-2596BE?style=for-the-badge&logo=trpc&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)

## Overview & Architecture

Interview AI is an end-to-end type-safe monorepo built to facilitate highly interactive, AI-driven technical mock interviews. It seamlessly integrates a robust, modern full-stack web architecture with powerful AI evaluation capabilities.

### Key Subsystems

- **Engineering Mode**: A rich, live code editor powered by Monaco Editor, providing candidates with a familiar and responsive coding environment.
- **Real-time Audio Processing**: Utilizes the Web Audio API (`AnalyserNode`) combined with an HTML5 Canvas visualizer to provide immediate, dynamic audio feedback during spoken interactions.
- **Speech-to-Text Pipeline**: Built on top of the browser-native Web Speech API, seamlessly transcribing spoken candidate responses into actionable text data.
- **AI Evaluation Engine**: Integrates with Google Gemini 1.5 Flash via highly optimized tRPC procedures to analyze both candidate code and transcriptions for accurate, context-aware evaluations.
- **Production Infrastructure**: Employs multi-stage Docker containerization for minimal build sizes and declarative Kubernetes manifests for scalable and resilient deployments.

## Repository Structure

```text
.
├── apps
│   └── web                    # Next.js 15 application (frontend & API routes)
├── packages
│   ├── database               # Drizzle ORM schema, migrations, and database client
│   ├── trpc                   # Shared tRPC routers and API type definitions
│   ├── ui                     # Shared UI components and design system
│   └── typescript-config      # Base TS configurations for workspace packages
├── k8s                        # Declarative Kubernetes deployment manifests
├── Dockerfile                 # Multi-stage Dockerfile for optimized production builds
└── docker-compose.yml         # Local development orchestration (Web + PostgreSQL)
```

## Tech Stack

| Category               | Technologies                                        |
|------------------------|-----------------------------------------------------|
| **Framework**          | Next.js 15, React, Turborepo                        |
| **Type Safety**        | TypeScript, tRPC v11                                |
| **ORM & Database**     | Drizzle ORM, PostgreSQL                             |
| **AI/ML**              | Google Gemini 1.5 Flash API                         |
| **Media Processing**   | Web Audio API, Web Speech API, HTML5 Canvas         |
| **Infrastructure**     | Docker, Docker Compose, Kubernetes                  |

## Local Development Setup

### Step 1: Prerequisites
Ensure your local environment meets the following requirements:
- Node.js >= 20
- pnpm >= 9
- PostgreSQL (running locally) or Docker (to run the database via compose)

### Step 2: Clone repository and install dependencies
```bash
git clone <repository-url>
cd interview-ai
pnpm install
```

### Step 3: Environment variable setup
Create a `.env` file at the root or within the necessary workspaces, ensuring you configure your required keys:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/interview_ai
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 4: Database schema migration
Push the Drizzle schema to your local PostgreSQL database:
```bash
pnpm --filter @repo/database db:push
```

### Step 5: Start development servers
Launch the Turborepo development pipeline (starts web server and any necessary watchers):
```bash
pnpm dev
```

## Containerization & Production Deployment

### Running with Docker Compose
To build and run the entire stack (including the database) using Docker Compose:
```bash
docker-compose up --build -d
```

### Deploying to Kubernetes
The application can be deployed to a Kubernetes cluster using the provided declarative manifests:
```bash
kubectl apply -k k8s/
```

## Verification & Scripts

Key scripts available across the workspace:
- `pnpm build`: Run production builds across all apps and packages using Turborepo.
- `pnpm lint`: Run ESLint checks across the workspace.
- `pnpm db:push`: Synchronize the database schema using Drizzle ORM.
- `pnpm db:studio`: Launch Drizzle Studio for a local database GUI.
