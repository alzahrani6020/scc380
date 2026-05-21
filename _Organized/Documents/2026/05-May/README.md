# 🏢 Smart Command Center | مركز القيادة الذكي 380

Hybrid Multi-Tenant SaaS Platform for Saudi Market

## 📁 Project Structure

```
smart-command-center/
│
├── apps/
│   ├── web/           # Next.js - Client Dashboard (port 3000)
│   ├── admin/         # Next.js - Super Admin Panel (port 3002)
│   ├── api/           # NestJS - Main API (port 3001)
│   ├── gateway/       # NestJS - API Gateway (port 3000)
│   ├── ai-service/    # Express - AI Microservice (port 3003)
│   └── mobile/        # (Reserved for React Native / Expo)
│
├── packages/
│   ├── ui/            # Shared React Components
│   ├── types/         # Shared TypeScript Types
│   ├── auth/          # Shared Auth Utilities (JWT, Passwords, Permissions)
│   ├── database/      # Prisma Schema + Client
│   ├── config/        # Shared ESLint, TS, Tailwind configs
│   └── utils/         # Shared Helpers, Validators, Formatters
│
├── infrastructure/
│   ├── docker/        # Docker Compose (dev + prod)
│   ├── nginx/         # Nginx Reverse Proxy Config
│   ├── coolify/       # Coolify Deployment Config
│   ├── monitoring/    # Prometheus + Grafana configs
│   └── backup/        # Database backup scripts
│
├── docs/              # Documentation
├── scripts/           # Automation scripts
├── docker-compose.yml # Root dev compose
├── turbo.json         # Turbo Repo config
└── pnpm-workspace.yaml
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Setup Environment
```bash
cp .env.example .env
```

### 3. Start Infrastructure
```bash
pnpm docker:up
# or
docker compose -f infrastructure/docker/dev/docker-compose.yml up -d
```

### 4. Database Setup
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Run Development
```bash
pnpm dev
```

Services will be available at:
- **Web Dashboard**: http://localhost:3000
- **Admin Panel**: http://localhost:3002
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs
- **AI Service**: http://localhost:3003
- **Keycloak**: http://localhost:8080

## 🏗️ Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Web      │  │    Admin    │  │   Mobile    │
│  (Next.js)  │  │  (Next.js)  │  │  (Future)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              ┌─────────▼──────────┐
              │   API Gateway      │
              │   (NestJS)         │
              └─────────┬──────────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│    API      │  │ AI Service  │  │  External   │
│  (NestJS)   │  │  (Express)  │  │  Services   │
└──────┬──────┘  └─────────────┘  └─────────────┘
       │
       ├──────────┬──────────┬──────────┐
       │          │          │          │
┌──────▼──────┐ ┌─▼─────┐ ┌──▼───┐ ┌───▼───┐
│  PostgreSQL │ │ Redis │ │MinIO │ │Ollama │
└─────────────┘ └───────┘ └──────┘ └───────┘
```

## 🔐 Hybrid Deployment

| Feature | Shared Cloud | Private Cloud |
|---------|-------------|---------------|
| Tenancy | Multi-Tenant | Single-Tenant |
| Database | Schema per tenant | Dedicated instance |
| Isolation | Logical | Container/VM |
| Pricing | Subscription | Enterprise + Setup |

## 🇸🇦 Saudi Government Integrations

- **ZATCA (Fatoora)** - E-Invoicing Phase 1 & 2
- **Absher** - Identity Verification
- **MOMRAH** - Municipal Services
- **Ministry of Commerce** - CR Validation

## 🛡️ Security & Compliance

- ✅ BYOK (Bring Your Own Key) Encryption
- ✅ PAM - Privileged Access Management
- ✅ Saudi Data Residency
- ✅ NCA Cybersecurity Compliance
- ✅ PDPL - Personal Data Protection Law

## 📄 License

Private - Smart Command Center 380
