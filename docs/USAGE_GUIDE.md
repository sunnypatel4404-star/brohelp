# WordPress AI Agent - Complete Usage Guide

## Overview

Your WordPress AI Agent is fully functional! It can:
1. ✅ Generate articles using ChatGPT
2. ✅ Generate on-brand images using DALL-E
3. ✅ Automatically upload articles to WordPress.com as drafts
4. ✅ Generate Pinterest pin variations (5 per article)
5. ✅ Save pins for your review and approval
6. ✅ Suggest relevant tags for Pinterest pins

## Complete Workflow

### Step 1: Generate Article + Image (One Command!)

```bash
npm run generate-article "Your Article Topic"
```

**What happens:**
- ChatGPT writes a 1000-1200 word article in your voice
- DALL-E creates an on-brand illustration
- Article automatically uploads to WordPress as a DRAFT
- Image is saved locally and used as WordPress featured image

**Example:**
```bash
npm run generate-article "Building independence in toddlers through daily chores"
```

**Output:**
- Article title
- Article excerpt
- Generated image path
- WordPress draft link for review
- Direct edit URL in WordPress admin

### Step 2: Review in WordPress

1. Click the provided edit link
2. Review article quality, tone, and accuracy
3. Make any edits needed
4. Leave as draft or publish immediately

### Step 3: Generate Pinterest Pins

Once your article is in WordPress (draft or published), generate pins:

```bash
npm run generate-pins "Your Article Topic" [post_id]
```

**Example:**
```bash
npm run generate-pins "Building independence in toddlers through daily chores" 522
```

**What happens:**
- Generates 5 different pin variations with different angles
- Creates Pinterest-optimized titles and descriptions
- Suggests relevant hashtags
- Saves everything to JSON for review

**Output shows:**
- 5 different pin variations (titles, descriptions, angles)
- Suggested tags (copy/paste into Pinterest)
- Pin draft ID (for approval/upload)
- Statistics on all saved pins

### Step 4: Review Pins and Tags

Review the 5 pin variations displayed. Each has:
- **Title**: Pinterest-optimized, emoji-friendly
- **Description**: Call-to-action included
- **Angle**: How the pin approaches the topic
- **Link**: Points back to your blog post
- **Board**: Suggested Pinterest board name

### Step 5: Manual Upload to Pinterest

Since Pinterest API doesn't support auto-posting, you upload manually:

1. **Get the suggested tags:**
   - Copy from command output
   - Paste into Pinterest when creating pins

2. **Create pins manually:**
   - Go to Pinterest.com
   - Create new pins using the 5 variations
   - Use the titles and descriptions provided
   - Upload your article image
   - Add the suggested tags
   - Use the blog post link

3. **Mark pins as published:**
   ```bash
   npm run approve-pins [pin_id]
   ```

## Available Commands

### Article Generation
```bash
npm run generate-article "Topic"          # Generate article + image + upload
npm run generate-image "Topic"            # Generate just the image
```

### WordPress Management
```bash
npm run publish-draft [post_id]           # Publish a WordPress draft
```

### Pinterest Pin Generation
```bash
npm run generate-pins "Topic" [post_id]   # Generate 5 pin variations
npm run approve-pins [pin_id]             # Mark pins as approved
npm run upload-pins [pin_id]              # Upload pins to Pinterest
```

## Configuration

### Bot Writing Style
Edit: `src/config/botConfig.ts`

Customize:
- Article tone and voice
- Word count
- Content types included
- Publishing frequency

### Pinterest Pins
Edit: `src/config/pinConfig.ts`

Customize:
- Pin variation templates
- Standard tags
- Age-group tags
- Call-to-action options

## File Locations

### Generated Files
- **Generated images:** `generated_images/`
- **Pinterest pin drafts:** `saved_pins/`

### Configuration
- **Bot settings:** `src/config/botConfig.ts`
- **Pin settings:** `src/config/pinConfig.ts`

### Services
- **Article generation:** `src/services/chatgptService.ts`
- **Image generation:** `src/services/imageGenerationService.ts`
- **Pin generation:** `src/services/pinGenerationService.ts`
- **WordPress upload:** `src/services/wordpressXmlrpcService.ts`
- **Pin storage:** `src/services/pinStorageService.ts`

## Cost & API Usage

### Per Article Generation
- **ChatGPT (article):** ~$0.01-0.05
- **DALL-E 3 (image):** ~$0.10-0.20
- **Total per article:** ~$0.15-0.25

### Recommendations
- Generate 1-2 articles daily = $0.45-1.50/day
- Consider batching off-peak hours
- Monitor your OpenAI usage dashboard

## Troubleshooting

### Article Generation Fails
**"Missing OPENAI_API_KEY"**
- Check `.env` file has OPENAI_API_KEY

**"Exceeded quota"**
- Add credits to OpenAI account
- Check: https://platform.openai.com/account/billing/overview

### WordPress Upload Fails
**"404 Error"**
- Verify WORDPRESS_URL in `.env`
- Check application password is correct
- Ensure XML-RPC is enabled on WordPress.com

### Image Generation Fails
**"No image returned"**
- Check OPENAI_API_KEY is valid
- Verify credits available
- Try again (rate limiting possible)

## Best Practices

### Article Quality
1. ✅ Always review before publishing
2. ✅ Edit for your specific voice
3. ✅ Add internal links
4. ✅ Verify factual claims
5. ✅ Add featured image if needed

### Pinterest Success
1. ✅ Use all 5 pin variations (different angles work better)
2. ✅ Add tags consistently
3. ✅ Create descriptive board names
4. ✅ Post during peak hours (9am-3pm)
5. ✅ Monitor which pins get engagement

### SEO & Content Strategy
1. ✅ Use target keywords in article titles
2. ✅ Include internal links
3. ✅ Use H2/H3 headings properly
4. ✅ Keep alt text descriptive
5. ✅ Update pinned content regularly

## Next Features (Future)

Potential enhancements:
- [ ] Auto Pinterest board creation
- [ ] Auto tag application (via browser extension)
- [ ] Pinterest analytics integration
- [ ] SEO optimization suggestions
- [ ] Scheduled posting via cron
- [ ] Email notifications
- [ ] Dashboard/web interface
- [ ] Video pin generation

## Support & Debugging

### Check Bot Configuration
```bash
cat src/config/botConfig.ts    # View writing style settings
cat src/config/pinConfig.ts    # View Pinterest settings
```

### View Generated Content
```bash
ls generated_images/           # See generated images
ls saved_pins/                 # See pin drafts
```

### Monitor API Usage
- ChatGPT: https://platform.openai.com/account/usage/overview
- WordPress.com: Dashboard > Site Stats

## Tips for Maximum Productivity

1. **Batch generation:** Generate 3-5 articles in one session
2. **Schedule uploads:** Upload pins during peak engagement times
3. **Reuse content:** Create multiple pin variations per article
4. **Update old posts:** Regenerate pins for evergreen content
5. **Monitor performance:** Track which pins drive traffic

## Questions?

Check the detailed documentation:
- `README.md` - Project overview
- `BOT_CONFIG.md` - Configuration details
- `PINTEREST_IMPLEMENTATION.md` - Pinterest integration details

Happy content creating! 🚀
