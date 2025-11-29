# Image Generation Guide

## Overview

The system now generates **two separate images** for each article:

1. **WordPress Featured Image** - Square format (1024x1024) for blog headers
2. **Pinterest Pin Image** - Vertical format (1024x1792, 2:3 ratio) optimized for Pinterest

Both images follow the **ParentVillage Pastel Pinterest Style** but are optimized for their specific use cases.

## ParentVillage Pastel Pinterest Style

### Style Requirements

**Color Palette:**
- Soft pastels: gentle pinks, baby blues, mint green, lavender, peach, cream, butter yellow
- NO saturated colors, NO bold colors, NO bright primary colors
- Clean, bright background with lots of negative space
- White or very light cream for maximum brightness

**Illustration Style:**
- Flat illustration (children's book aesthetic)
- NO gradients whatsoever
- NO photorealism or 3D effects
- NO harsh shadows
- Minimal shading and texture
- Rounded, friendly character design
- Soft, low-contrast line art in brown or muted purple

**Typography:**
- Rounded, playful, friendly fonts (children's book style)
- Soft brown or muted purple text (NOT black)
- Legible but gentle

**Overall Vibe:**
- Warm and cheerful
- Mom-friendly and inviting
- Gentle and calming
- Modern minimalist
- Pinterest-ready aesthetic

## Image Type Configurations

### WordPress Featured Image

**Format:** Square (1024x1024)
**Quality:** Standard
**Use Case:** Blog header and featured image

**Composition:**
- Centered main illustration
- Balanced, symmetrical layout
- Lots of breathing room around elements
- Can include subtle title text if compositionally appropriate
- Small "ParentVillage.blog" branding if space allows

**Watermark:** Added programmatically by Sharp library after generation

### Pinterest Pin Image

**Format:** Vertical (1024x1792, 2:3 ratio)
**Quality:** HD (higher quality for Pinterest)
**Use Case:** Pinterest pin sharing and promotion

**Composition:**
- **TOP:** Large, clean title text in a rounded, playful font
- **CENTER:** Main illustration (simple, friendly, minimal)
- **BOTTOM:** Small branding text "ParentVillage.blog"
- Lots of negative space around elements
- Clean, uncluttered layout

**Watermark:** Included in the DALL-E prompt (part of the design)

## How It Works

### Command Line (Recommended)

Generate an article with both images:

```bash
npm run generate-article "Your Article Topic"
```

This will:
1. Generate article content with ChatGPT
2. Generate WordPress featured image (square)
3. Generate Pinterest pin image (vertical)
4. Upload article to WordPress as draft
5. Upload WordPress image as featured image
6. Generate 5 Pinterest pin variations using the vertical image
7. Save pins for review and export

### Programmatic Usage

```typescript
import { ImageGenerationService } from './services/imageGenerationService';

const imageService = new ImageGenerationService(apiKey);

// Generate WordPress featured image
const wpImage = await imageService.generateArticleImage({
  topic: "Building independence in toddlers",
  articleTitle: "5 Ways to Build Independence in Toddlers",
  imageType: 'wordpress'
});

// Generate Pinterest pin image
const pinImage = await imageService.generateArticleImage({
  topic: "Building independence in toddlers",
  articleTitle: "5 Ways to Build Independence in Toddlers",
  imageType: 'pinterest'
});
```

## Configuration Files

### Main Config: `src/backend/config/imageConfig.ts`

This file contains:
- `wordpressImageConfig` - WordPress featured image settings
- `pinterestImageConfig` - Pinterest pin image settings
- `getImageConfig(type)` - Helper to get config by type

**Customization:**

You can modify the prompts and settings in this file to adjust:
- Image size (limited by DALL-E 3: 1024x1024, 1024x1792, 1792x1024)
- Quality (standard or hd)
- Style (natural or vivid)
- Prompt templates (customize the style requirements)

Example:

```typescript
export const pinterestImageConfig: ImageGenerationConfig = {
  size: '1024x1792',
  quality: 'hd',
  style: 'natural',
  promptTemplate: (topic: string, articleTitle?: string) => {
    // Customize your prompt here
    return `Your custom prompt...`;
  }
};
```

## Image File Naming

Images are saved with prefixes to distinguish types:

- `wp_topic-name_timestamp.png` - WordPress featured images
- `pin_topic-name_timestamp.png` - Pinterest pin images

All images are saved to: `generated_images/`

## Database Storage

Image metadata is automatically saved to SQLite:

```sql
-- Images table
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  topic TEXT,
  local_path TEXT NOT NULL,
  wordpress_url TEXT,
  created_at TEXT NOT NULL,
  file_size INTEGER
);
```

## Workflow Integration

### Full Article Generation Flow

1. **Article Generation** - ChatGPT generates article content
2. **WordPress Image** - Square image generated for blog header
3. **Pinterest Image** - Vertical image generated for Pinterest
4. **WordPress Upload** - Article + WordPress image uploaded
5. **Pin Generation** - 5 pin variations created using Pinterest image
6. **Pin Storage** - Pins saved to database for review

### Manual Image Generation

Generate only images without article:

```bash
npm run generate-image "Your Topic"
```

This will generate both WordPress and Pinterest images.

## Cost Considerations

**DALL-E 3 Pricing (as of 2024):**
- Standard quality (1024x1024): ~$0.040 per image
- HD quality (1024x1792): ~$0.080 per image

**Per Article:**
- WordPress image (standard 1024x1024): ~$0.040
- Pinterest image (HD 1024x1792): ~$0.080
- **Total per article: ~$0.120**

This is in addition to ChatGPT costs (~$0.15-0.25 per article).

## Troubleshooting

### Images Don't Match Style

1. Check `src/backend/config/imageConfig.ts`
2. Verify prompt includes all style requirements
3. Ensure `style: 'natural'` is set (not 'vivid')
4. Consider adjusting quality or regenerating

### Wrong Aspect Ratio

1. Verify `imageType` parameter is correct:
   - `'wordpress'` → 1024x1024 (square)
   - `'pinterest'` → 1024x1792 (vertical)
2. Check `imageConfig.ts` size settings

### Watermark Issues

**WordPress Images:**
- Watermark added by Sharp after generation
- Check `imageGenerationService.ts` `addWatermark()` method

**Pinterest Images:**
- Watermark included in DALL-E prompt
- Modify prompt in `imageConfig.ts` to adjust

## Best Practices

1. **Review Images Before Publishing**
   - Always check generated images match your brand
   - Regenerate if style is off

2. **Pinterest Optimization**
   - Use the vertical Pinterest image for all Pinterest pins
   - Don't use WordPress square image for Pinterest

3. **Consistency**
   - Keep style prompts consistent across both image types
   - Only customize composition (vertical vs square layout)

4. **Cost Management**
   - Standard quality is usually sufficient for WordPress
   - HD quality recommended for Pinterest (better engagement)

## Example Output

After running `npm run generate-article "Building independence in toddlers"`:

```
📄 Article generated successfully

🖼️  Generating WordPress featured image...
✓ WordPress featured image generated (1024x1024)

📌 Generating Pinterest pin image...
✓ Pinterest pin image generated (1024x1792)

📁 Images saved:
- WordPress: wp_building-independence-in-to_1234567890.png
- Pinterest: pin_building-independence-in-to_1234567890.png

✅ Article uploaded to WordPress as DRAFT!
✅ Featured image uploaded successfully

📌 Generated 5 Pinterest pin variations!
```

## Further Customization

To customize the style further:

1. Edit `src/backend/config/imageConfig.ts`
2. Modify the `promptTemplate` function for each image type
3. Adjust colors, composition, or design requirements
4. Rebuild: `npm run build`
5. Test: `npm run generate-article "test topic"`

## Support

For issues or questions:
- Check the main project documentation: `CLAUDE.md`
- Review image generation service: `src/backend/services/imageGenerationService.ts`
- Inspect configuration: `src/backend/config/imageConfig.ts`
