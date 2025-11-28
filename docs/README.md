# WordPress AI Agent - Parent Village Blog Automation

Automated article generation, image creation, and Pinterest pin management for your parenting blog using ChatGPT and DALL-E.

## Features

✨ **Complete Content Automation**
- Generate full articles using ChatGPT with customized brand voice
- Create on-brand illustrations using DALL-E 3
- Auto-upload articles to WordPress.com
- Automatically generate 5 Pinterest pin variations per article
- Add watermarks to images and articles
- Set featured images on WordPress posts

📝 **Article Generation**
- ChatGPT-powered content creation
- Customizable article length (1000-1200 words default)
- Automatic excerpt generation
- Brand voice configuration
- Supports multiple age groups (infant, toddler, preschool, child)

🎨 **Image Generation**
- DALL-E 3 illustrations with customized style
- Warm, inviting, child-friendly aesthetic
- Pastel + warm earth tone color palette
- Automatic watermark addition
- Image optimization

📌 **Pinterest Pin Management**
- 5 different pin angle variations per article:
  - Instructional/Step-by-step ("How to...")
  - Listicle/Multiple solutions ("X Ways to...")
  - Educational/Research-backed ("Why... matters")
  - Relatable/Problem-solution ("Is your child...")
  - Comprehensive/Reference ("Complete guide")
- CSV export in Pinterest's new bulk upload format
- Pin review and approval workflow
- Suggested hashtags and tags

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git
- WordPress.com blog with XML-RPC enabled
- OpenAI API key (for ChatGPT and DALL-E)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/wordpress-ai-agent.git
cd wordpress-ai-agent
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
WORDPRESS_URL=https://yourblogs.wordpress.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_password
OPENAI_API_KEY=sk-...
```

4. **Build the project**
```bash
npm run build
```

## Usage

### Generate Article with Image and Pins

```bash
npm run generate-article "Your Article Topic"
```

This will:
- Generate a full article
- Create an on-brand illustration with watermark
- Upload article to WordPress as draft
- Auto-upload featured image
- Generate 5 Pinterest pin variations
- Save pins as JSON

Example:
```bash
npm run generate-article "Building independence in toddlers through daily routines"
```

### Review Pins

```bash
# List all pins
npm run review-pins
npm run review-pins list

# View specific pin details
npm run review-pins <pin_id> view

# Example
npm run review-pins pin_1763898974565 view
```

### Approve Pins

```bash
npm run review-pins <pin_id> approve
```

### Export Pins to CSV (Pinterest Format)

```bash
npm run review-pins <pin_id> export
```

Creates a CSV file in `pin_exports/` ready for Pinterest's bulk uploader.

### Upload to Pinterest

1. Go to https://ads.pinterest.com/
2. Click "Create" → "Bulk upload"
3. Upload the CSV file from `pin_exports/`
4. Review pins in preview
5. Click "Publish" to upload all 5 pins

## Project Structure

```
wordpress-ai-agent/
├── src/
│   ├── commands/           # CLI commands
│   │   ├── generateArticle.ts      # Main article generation
│   │   ├── generateImage.ts        # Image generation only
│   │   ├── generatePins.ts         # Pin generation only
│   │   ├── reviewPins.ts           # Pin management
│   │   ├── publishDraft.ts         # Publish WordPress drafts
│   │   ├── dashboard.ts            # CLI dashboard
│   │   └── server.ts               # HTTP server
│   ├── services/           # Business logic
│   │   ├── chatgptService.ts       # ChatGPT integration
│   │   ├── imageGenerationService.ts   # DALL-E integration
│   │   ├── wordpressXmlrpcService.ts   # WordPress API
│   │   ├── pinGenerationService.ts     # Pin generation logic
│   │   └── pinStorageService.ts        # Pin file management
│   ├── config/             # Configuration
│   │   ├── botConfig.ts            # Brand voice settings
│   │   └── pinConfig.ts            # Pin templates and settings
│   └── index.ts            # Entry point
├── dist/                   # Compiled JavaScript
├── generated_images/       # Generated article images
├── saved_pins/             # Pin data (JSON)
├── pin_exports/            # Exported CSV files
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
└── README.md               # This file
```

## Configuration

### Brand Voice Configuration

Edit `src/config/botConfig.ts` to customize:
- Publishing frequency
- Word count range
- Article tone
- Mom Tips sections
- Featured content areas
- Hashtags and categories

### Pin Configuration

Edit `src/config/pinConfig.ts` to customize:
- Pin title templates
- Pin description templates
- Board naming
- Tags
- Age group keywords

### Image Style

Edit `src/services/imageGenerationService.ts` DALL-E prompt to customize:
- Color palette
- Style (flat design, vector, etc.)
- Character representation
- Overall aesthetic

## Available Commands

```bash
# Generate article + image + pins
npm run generate-article "topic"

# Generate image only
npm run generate-image "topic"

# Generate pins for existing article
npm run generate-pins "topic" [post_id]

# Review, approve, export pins
npm run review-pins                    # List all pins
npm run review-pins <pin_id> view      # View pin details
npm run review-pins <pin_id> approve   # Approve pin
npm run review-pins <pin_id> export    # Export to CSV

# Publish WordPress draft
npm run publish-draft <post_id>

# View dashboard
npm run dashboard

# Start web server
npm run server

# Build TypeScript
npm run build

# Development mode
npm run dev
```

## API Keys & Setup

### OpenAI API Key

1. Go to https://platform.openai.com/account/api-keys
2. Create a new API key
3. Add to `.env`: `OPENAI_API_KEY=sk-...`

### WordPress.com

1. Get your blog URL: `https://yourblog.wordpress.com`
2. Create an application password in WordPress settings
3. Enable XML-RPC (WordPress Settings → Writing)
4. Add credentials to `.env`:
   ```
   WORDPRESS_URL=https://yourblog.wordpress.com
   WORDPRESS_USERNAME=your_username
   WORDPRESS_PASSWORD=your_password
   ```

### Pinterest

- Account required at https://pinterest.com
- Access bulk uploader at https://ads.pinterest.com/
- No API setup needed - uses CSV upload

## File Outputs

### Generated Images
- Location: `generated_images/`
- Format: PNG with watermark
- Size: 1024x1124px (includes watermark space)

### Saved Pins
- Location: `saved_pins/`
- Format: JSON
- Contains all 5 variations per article
- Includes suggested tags and metadata

### Exported CSVs
- Location: `pin_exports/`
- Format: CSV compatible with Pinterest bulk uploader
- Headers: Campaign Name, Ad Group Name, Promoted Pin Name, Pin Title, Pin Description, Media File Name, Organic Pin URL, Image Alternative Text

## Troubleshooting

### "Missing WordPress configuration"
- Check your `.env` file has all required WordPress credentials
- Verify XML-RPC is enabled in WordPress settings

### "Missing OPENAI_API_KEY"
- Add your OpenAI API key to `.env`
- Check it's a valid API key from https://platform.openai.com/

### Featured image not uploading
- Ensure WordPress XML-RPC is enabled
- Check file permissions on generated_images/
- Verify image file exists before upload

### CSV not accepted by Pinterest
- Ensure headers match exactly: Campaign Name, Ad Group Name, Promoted Pin Name, etc.
- Check image URLs are accessible
- Verify link URLs are valid

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC

## Support

For issues and questions:
1. Check the README above
2. Review your `.env` configuration
3. Ensure all dependencies are installed
4. Check generated output in folders above

---

Made with ❤️ for Parent Village Blog
