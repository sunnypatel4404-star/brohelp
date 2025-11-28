# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing two projects:
1. **wordpress-ai-agent** - Backend TypeScript CLI for automated blog content generation
2. **wordpress-ai-agent-frontend** - React + TypeScript + Vite web dashboard

The system generates blog articles using ChatGPT, creates illustrations using DALL-E 3, uploads to WordPress.com via XML-RPC, and generates Pinterest pin variations.

## Repository Structure

```
/
├── wordpress-ai-agent/          # Backend TypeScript project
│   ├── src/
│   │   ├── services/            # Core business logic
│   │   ├── commands/            # CLI command implementations
│   │   ├── config/              # botConfig.ts & pinConfig.ts
│   │   └── server/              # Express server for dashboard API
│   ├── generated_images/        # DALL-E generated images with watermarks
│   ├── saved_pins/              # Pinterest pin JSON storage
│   ├── pin_exports/             # CSV exports for Pinterest bulk upload
│   └── dist/                    # TypeScript build output
│
└── wordpress-ai-agent-frontend/ # React dashboard
    ├── src/
    │   ├── pages/               # Dashboard page components
    │   └── services/            # API client
    └── dist/                    # Vite build output
```

## Build and Development Commands

### Backend (wordpress-ai-agent/)

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Development mode (ts-node)
npm run dev

# Generate content
npm run generate-article "topic"          # Full workflow: article + image + pins
npm run generate-image "topic"            # Image generation only
npm run generate-pins "topic" [post_id]   # Pinterest pins only

# Management
npm run review-pins                       # List all pins
npm run review-pins <pin_id> view         # View pin details
npm run review-pins <pin_id> approve      # Approve pin
npm run review-pins <pin_id> export       # Export to Pinterest CSV
npm run publish-draft <post_id>           # Publish WordPress draft

# Dashboards
npm run dashboard [summary|pins|stats|timeline|full|help]
npm run server                            # Start web dashboard API (port 3000)
npm run api                               # Alternative API server entry
```

### Frontend (wordpress-ai-agent-frontend/)

```bash
# Install dependencies
npm install

# Development server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Architecture Overview

### Content Generation Flow

1. **Article Generation** (`chatgptService.ts`)
   - Uses OpenAI GPT-4 with custom system prompt from `botConfig.ts`
   - Returns JSON with title, content (HTML), and excerpt
   - Configured for 1000-1200 words, warm/conversational tone
   - Includes "💛 Mom Tip" sections and emojis

2. **Image Generation** (`imageGenerationService.ts`)
   - Uses DALL-E 3 with brand-specific prompts (flat design, pastel colors)
   - Adds watermark using Sharp
   - Saves to `generated_images/`

3. **WordPress Upload** (`wordpressXmlrpcService.ts`)
   - Custom XML-RPC client implementation (no external library)
   - Uploads post as draft via `wp.newPost`
   - Uploads featured image via `wp.uploadFile` + `wp.editPost`
   - Returns post ID and edit URL

4. **Pinterest Pin Generation** (`pinGenerationService.ts`)
   - Creates 5 pin variations per article with different angles:
     - Instructional ("How to...")
     - Listicle ("X Ways to...")
     - Educational ("Why... matters")
     - Relatable ("Is your child...")
     - Comprehensive ("Complete guide")
   - Stores as JSON in `saved_pins/`
   - Exports to Pinterest CSV format

### Key Services

- **chatgptService.ts** - OpenAI API client for article generation
- **imageGenerationService.ts** - DALL-E 3 integration + watermarking
- **wordpressXmlrpcService.ts** - WordPress.com XML-RPC implementation
- **pinGenerationService.ts** - Pinterest pin variation logic
- **pinStorageService.ts** - File-based pin management (JSON storage)
- **dashboardService.ts** - Analytics and stats aggregation

### Configuration Files

All customization happens in two config files:

- **src/config/botConfig.ts** - ChatGPT system prompt, tone, word count, content requirements
- **src/config/pinConfig.ts** - Pinterest pin templates, hashtags, age group tags

### Data Storage

No database used. All data stored as local files:
- Images: `generated_images/*.png`
- Pins: `saved_pins/*.json` (includes status: draft/approved/published)
- CSV exports: `pin_exports/*.csv`

## Environment Setup

Required `.env` variables (backend only):

```
WORDPRESS_URL=https://yourblogs.wordpress.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_application_password
OPENAI_API_KEY=sk-...
```

## Testing

No test suite currently implemented. Manual testing via CLI commands.

## Common Development Patterns

### Adding New CLI Commands

1. Create command file in `src/commands/`
2. Add script entry to `package.json`
3. Use existing services from `src/services/`

### Modifying Article Style

Edit `src/config/botConfig.ts`:
- Update `systemPrompt` for ChatGPT instructions
- Adjust `tone`, `wordCountMin/Max`, `contentTypes`

### Modifying Pin Templates

Edit `src/config/pinConfig.ts`:
- Update `PIN_ANGLES` array for different variations
- Modify `generatePinTitle()` and `generatePinDescription()` functions

### WordPress Integration Notes

- Uses XML-RPC (not REST API) for WordPress.com compatibility
- Custom XML builder in `wordpressXmlrpcService.ts` (no dependencies)
- Featured images uploaded separately via `wp.uploadFile` then linked via `wp.editPost`
- All posts created as drafts by default

## Frontend Dashboard

Built with React + TypeScript + Vite + TailwindCSS. Fetches data from backend Express server (port 3000) via REST API endpoints. Shows:
- Article/pin/image counts
- Pin status distribution
- 30-day activity timeline
- Pin management interface

Backend API routes defined in `src/server/dashboardServer.ts`.

## Important Notes

- TypeScript strict mode enabled - all code is type-safe
- OpenAI API costs ~$0.15-0.25 per article (ChatGPT + DALL-E)
- Pinterest integration is manual (CSV upload) - no API integration
- WordPress XML-RPC must be enabled in blog settings
