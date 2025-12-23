# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A unified TypeScript monorepo for automated parenting blog content generation. The system generates blog articles using ChatGPT, creates illustrations using DALL-E 3/Gemini, uploads to WordPress.com via XML-RPC, and generates Pinterest pin variations.

## Repository Structure

```
/
├── src/
│   ├── backend/
│   │   ├── commands/           # CLI command implementations
│   │   ├── config/             # botConfig.ts & pinConfig.ts
│   │   ├── database/           # SQLite database schema
│   │   ├── middleware/         # Auth middleware
│   │   ├── server/             # Express API servers
│   │   └── services/           # Core business logic
│   └── frontend/
│       ├── pages/              # Dashboard page components
│       └── services/           # API client
├── tests/                      # Jest test suites
├── logs/                       # Winston log files
├── backups/                    # Image backups
├── generated_images/           # AI generated images with watermarks
├── data/                       # SQLite database (brohelp.db)
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

# Testing
npm test                        # Run all tests
npm run test:watch              # Watch mode
npm run test:coverage           # With coverage report

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

### Core Services
- **chatgptService.ts** - OpenAI GPT-4 article generation with timeout/retry handling
- **imageGenerationService.ts** - DALL-E 3/Gemini image generation + Sharp watermarking
- **wordpressXmlrpcService.ts** - Custom XML-RPC client for WordPress.com
- **pinGenerationService.ts** - Pinterest pin variations (2-3 angles per article)
- **pinStorageService.ts** - SQLite-backed pin management with hashtag formatting
- **dashboardService.ts** - Analytics and stats aggregation

### New Services (v2.0)
- **logger.ts** - Winston structured logging with file rotation
- **retryQueueService.ts** - Automatic retry for failed jobs with exponential backoff
- **duplicateDetectionService.ts** - Prevents duplicate article generation
- **schedulerService.ts** - Content scheduling with recurring support
- **imageBackupService.ts** - Local image backup with retention policies
- **wordpressSyncService.ts** - Detect WordPress post changes/deletions

### Middleware
- **auth.ts** - API key authentication with hashed storage

## API Server

The API server (`src/backend/server/apiServer.ts`) runs on port 5000 (configurable via `API_PORT`).

### Core Endpoints
- `POST /api/articles/generate` - Generate article (async job, duplicate detection)
- `GET /api/jobs/:id` - Check job status
- `GET /api/dashboard` - Dashboard stats
- `GET /api/pins` - List pins
- `POST /api/pins/:id/approve` - Approve pin
- `POST /api/pins/export` - Export to CSV

### Authentication (v2.0)
- `POST /api/auth/keys` - Generate API key
- `GET /api/auth/keys` - List API keys
- `DELETE /api/auth/keys/:id` - Revoke API key

### Scheduling (v2.0)
- `POST /api/schedule` - Schedule content generation
- `GET /api/schedule` - List scheduled content
- `GET /api/schedule/upcoming` - Next scheduled items
- `PUT /api/schedule/:id` - Update schedule
- `DELETE /api/schedule/:id` - Cancel scheduled content

### Retry Queue (v2.0)
- `GET /api/retries` - Pending retries
- `GET /api/retries/stats` - Queue statistics
- `POST /api/retries/process` - Process due retries

### Articles (v2.0)
- `GET /api/articles/history` - Article history with stats
- `POST /api/articles/check-duplicate` - Check for duplicates before generating

### Image Backup (v2.0)
- `GET /api/backups/stats` - Backup statistics
- `POST /api/backups/run` - Run backup for all images
- `POST /api/backups/cleanup` - Clean up old backups
- `GET /api/backups/verify` - Verify backup integrity
- `POST /api/backups/restore` - Restore from backup

### WordPress Sync (v2.0)
- `GET /api/sync/summary` - Sync status summary
- `POST /api/sync/check` - Full sync check
- `GET /api/sync/post/:postId` - Check specific post
- `POST /api/sync/pull/:postId` - Pull remote status

### Health Check
- `GET /api/health` - System health with all feature stats

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
GOOGLE_API_KEY=AIza...        # For Gemini image generation
```

Optional:
```
API_PORT=5000                  # API server port
API_AUTH_DISABLED=false        # Disable auth for development
LOG_LEVEL=info                 # Logging verbosity
IMAGE_BACKUP_DIR=./backups/images
IMAGE_BACKUP_RETENTION_DAYS=90
```

## Data Storage

SQLite database (`./data/brohelp.db`) with tables:
- `pins` - Pin metadata and status
- `pin_variations` - Individual pin variations
- `images` - Generated image metadata
- `jobs` - Async job tracking
- `job_retries` - Retry queue
- `articles` - Article history for duplicate detection
- `scheduled_content` - Content scheduling
- `api_keys` - API key authentication

## Frontend

React + TypeScript + Vite + TailwindCSS dashboard at `src/frontend/`.
- Fetches from API server on port 5000
- Shows article/pin/image counts
- Pin status distribution and management
- 30-day activity timeline

## Testing

Jest test suite in `tests/`:
- `auth.test.ts` - API key authentication
- `duplicateDetection.test.ts` - Duplicate topic detection
- `retryQueue.test.ts` - Retry queue logic
- `scheduler.test.ts` - Content scheduling

Run tests: `npm test`

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Runs on push to main/develop
- Tests on Node 18.x and 20.x
- Linting, type checking, tests with coverage
- Security audit

## Notes

- TypeScript strict mode enabled
- WordPress XML-RPC must be enabled in blog settings
- Pinterest integration is manual CSV upload (no API)
- OpenAI costs ~$0.15-0.25 per article generation
- API authentication enabled by default (set `API_AUTH_DISABLED=true` for dev)
- Logs written to `./logs/` directory
- Image backups to `./backups/images/` with 90-day retention
