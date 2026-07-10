# Thread to PDF

Convert public X (Twitter) threads into beautifully designed PDF documents.

## Features

- Clean, magazine-quality PDF layout (no Twitter UI elements)
- Text and images only — no usernames, likes, or metadata
- Optional cover page with thread title
- Page numbers, elegant typography (Inter, IBM Plex Sans, Noto Sans)
- Dark/light mode UI
- Caching, rate limiting, and SSRF protection

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Query, React Hook Form
- **Backend:** Node.js, Fastify, Puppeteer, pdf-lib
- **Monorepo:** pnpm workspaces

## Project Structure

```
apps/
  web/       # React frontend
  server/    # Fastify API + PDF generation
packages/
  shared/    # Shared TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
pnpm install
```

If pnpm prompts about ignored build scripts, approve `esbuild` and `puppeteer`:

```bash
pnpm approve-builds
```

Install the Puppeteer browser (required for PDF generation):

```bash
cd apps/server && npx puppeteer browsers install chrome
```

If you see **"Something went wrong"**, Chrome is usually missing — run the command above, then restart with `pnpm dev:fresh`.

### Development

Run both frontend and backend:

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Build

```bash
pnpm build
```

### Production

```bash
# Build all packages
pnpm build

# Start server
cd apps/server && pnpm start
```

Serve the web app from `apps/web/dist` with any static file server.

## API

### POST /generate

**Request:**
```json
{
  "url": "https://x.com/username/status/1234567890",
  "options": {
    "coverPage": true,
    "pageNumbers": true,
    "fontFamily": "inter",
    "fontSize": 17
  }
}
```

**Response:** `application/pdf`

## Environment Variables

Copy `apps/server/.env.example` to `apps/server/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `RATE_LIMIT_MAX` | 10 | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window (ms) |
| `REQUEST_TIMEOUT_MS` | 120000 | Fetch timeout (ms) |
| `CACHE_TTL_MS` | 3600000 | PDF cache TTL (ms) |

## License

MIT
