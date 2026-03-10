# Panoptes

> Chain Intelligence, Unblinking.

Chain intelligence platform for the Republic AI ecosystem.
Validator monitoring, endpoint health tracking, and smart routing engine.

## Features

- Real-time validator monitoring and historical snapshots
- Endpoint health tracking with uptime/latency stats
- Network statistics with bonded ratio and block time trends
- **Intelligence Layer:** Composite scoring for endpoints and validators (EMA-smoothed)
- **Smart Routing:** Score-weighted endpoint selection with quadratic bias
- **Anomaly Detection:** 6 detectors (jailing, stake change, commission spike, endpoint down, block stale, mass unbonding)
- **Preflight Validation:** 6-step transaction pre-check pipeline with timeout protection
- REST API with rate limiting, caching, and security headers
- Interactive dashboard with score badges, anomaly alerts, and filtering

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL (Neon Serverless) + Prisma 7
- **Chain SDK:** republic-sdk
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Testing:** Vitest 4

## Development

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
git clone https://github.com/eren-karakus0/panoptes.git
cd panoptes
npm install
cp .env.example .env.local
# Fill in your Neon database credentials
npx prisma generate
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm test` | Run tests |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Tests with coverage |

## License

MIT
