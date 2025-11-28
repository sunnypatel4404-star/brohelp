# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A unified TypeScript monorepo for automated parenting blog content generation. The system generates blog articles using ChatGPT, creates illustrations using DALL-E 3, uploads to WordPress.com via XML-RPC, and generates Pinterest pin variations.

## Repository Structure

```
/
├── src/
│   ├── backend/
│   │   ├── commands/           # CLI command implementations
│   │   ├── config/             # botConfig.ts & pinConfig.ts
│   │   ├── server/             # Express API servers
│   │   └── services/           # Core business logic
│   └── frontend/
│       ├── pages/              # Dashboard page components
│       └── services/           # API client
├── docs/                       # Documentation files
├── generated_images/           # DALL-E generated images with watermarks
├── saved_pins/                 # Pinterest pin JSON storage
├── pin_exports/                # CSV exports for Pinterest bulk upload
└── dist/                       # Build output (backend + frontend)
```

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build everything
npm run build

# Development
npm run dev                     # Run backend + frontend concurrently
npm run dev:backend             # Backend only (ts-node)
npm run dev:frontend            # Frontend only (Vite HMR)

# Generate content
npm run generate-article "topic"    # Full workflow: article + image + pins
npm run generate-image "topic"      # Image generation only
npm run generate-pins "topic"       # Pinterest pins only

# Pin management
npm run review-pins                 # List all pins
npm run review-pins <id> view       # View pin details
npm run review-pins <id> approve    # Approve pin
npm run review-pins <id> export     # Export to Pinterest CSV

# Other
npm run publish-draft <post_id>     # Publish WordPress draft
npm run dashboard                   # CLI dashboard
npm run api                         # Start API server (port 5000)
npm run server                      # Start dashboard server
```

## Key Services

- **chatgptService.ts** - OpenAI GPT-4 article generation with timeout/retry handling
- **imageGenerationService.ts** - DALL-E 3 image generation + Sharp watermarking
- **wordpressXmlrpcService.ts** - Custom XML-RPC client for WordPress.com
- **pinGenerationService.ts** - Pinterest pin variations (5 angles per article)
- **pinStorageService.ts** - File-based pin management with hashtag formatting
- **dashboardService.ts** - Analytics and stats aggregation

## API Server

The API server (`src/backend/server/apiServer.ts`) runs on port 5000 and includes:
- Job tracking system for async article generation
- Rate limiting
- Input validation and sanitization

Key endpoints:
- `POST /api/articles/generate` - Generate article (async job)
- `GET /api/jobs/:id` - Check job status
- `GET /api/dashboard` - Dashboard stats
- `GET /api/pins` - List pins
- `POST /api/pins/:id/approve` - Approve pin
- `POST /api/pins/export` - Export to CSV

## Configuration

**src/backend/config/botConfig.ts** - ChatGPT settings:
- System prompt for article generation
- Tone, word count (1000-1200), content types
- "Mom Tip" sections and emoji usage

**src/backend/config/pinConfig.ts** - Pinterest settings:
- Pin angle templates (instructional, listicle, educational, etc.)
- Hashtag generation
- Age group tags

## Environment Variables

Required in `.env`:
```
WORDPRESS_URL=https://yourblog.wordpress.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_application_password
OPENAI_API_KEY=sk-...
```

## Data Storage

No database - all data stored as local files:
- `generated_images/*.png` - Images with watermarks
- `saved_pins/*.json` - Pin data (status: draft/approved/published)
- `pin_exports/*.csv` - Pinterest bulk upload format

## Frontend

React + TypeScript + Vite + TailwindCSS dashboard at `src/frontend/`.
- Fetches from API server on port 5000
- Shows article/pin/image counts
- Pin status distribution and management
- 30-day activity timeline

## Notes

- TypeScript strict mode enabled
- WordPress XML-RPC must be enabled in blog settings
- Pinterest integration is manual CSV upload (no API)
- OpenAI costs ~$0.15-0.25 per article generation
