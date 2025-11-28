# Pinterest & Image Generation Implementation Guide

## Brand Guidelines (Parent Village)

### Visual Style
- **Type**: Illustrative/vector graphics (cartoon-style, flat design)
- **Color Palette**: Pastel colors + warm earth tones
  - Pastel colors: Soft pinks, soft blues, soft greens, soft yellows
  - Earth tones: Beiges, warm browns, warm oranges
  - Combined for warm, inviting, calming aesthetic
- **Tone**: Gentle, child-friendly, approachable
- **Audience**: Parents, caregivers, early childhood educators

### Image Specifications
- **Dimensions**: 1000x1500px (standard Pinterest pin ratio)
- **Format**: PNG or JPG
- **Style**: Flat design illustrations with minimal, clean composition
- **Typography**: Sans-serif fonts, readable at small sizes
- **Elements**: Child, parent, activity scenes with simple shapes and friendly characters

## Integration Architecture

### Workflow Overview

```
Blog Article → ChatGPT → WordPress Draft
                              ↓
                        Featured Image Needed
                              ↓
                    DALL-E Image Generation
                    (brand-matched illustration)
                              ↓
                    WordPress Featured Image
                    (saves generated image)
                              ↓
                    Generate 3-5 Pin Variations
                    (different titles/descriptions/angles)
                              ↓
                    Create Pinterest Drafts
                    (save for review)
                              ↓
                    You Review & Approve
                              ↓
                    Create Pinterest Boards
                    + Upload Approved Pins
                              ↓
                    Add Tags Manually
                    (Pinterest doesn't support auto-tagging)
                              ↓
                    Publish on WordPress
```

## Implementation Components

### 1. Image Generation Service (`imageGenerationService.ts`)
**Purpose**: Generate on-brand illustrations for articles and pins

**Input**:
- Article topic
- Article content
- Brand guidelines

**Output**:
- AI-generated image (1000x1500px for pins)
- Saved to WordPress media library
- Used as featured image for blog post

**Prompt Engineering**:
```
Generate a flat design illustration for a parenting blog article about: [TOPIC]

Style requirements:
- Flat design, vector illustration style
- Warm, inviting, child-friendly aesthetic
- Color palette: Pastels (soft pinks, blues, greens) + warm earth tones (beiges, browns)
- Simple, minimalist composition
- Include people (parents/children) or relevant activity scenes
- No text overlays (we'll add title separately)
- Suitable for Pinterest (1000x1500px aspect ratio)

Avoid:
- Photorealistic images
- Overly complex designs
- Bright primary colors
- Professional/clinical appearance
```

### 2. Pinterest Service (`pinterestService.ts`)
**Purpose**: Create and manage Pinterest pins via API

**Capabilities**:
- Create pins with title, description, link
- Assign to boards
- Set dominant color
- Include alt text
- Add metadata

**Limitations** (Pinterest API):
- Cannot auto-add tags (manual required)
- Cannot auto-create boards (manual required)
- Cannot set descriptions with hashtags (we'll suggest them separately)

### 3. Pin Generation Command (`generatePin.ts`)
**Purpose**: Generate multiple pin variations from article

**Process**:
1. Takes published/draft WordPress post
2. Extracts article content, title, excerpt
3. Generates 3-5 pin variations with different:
   - Headlines (benefit-driven, curiosity, question-based)
   - Descriptions (different angles/hooks)
   - Focus areas (different aspects of topic)
4. Returns pin drafts for review

**Pin Variation Strategy**:

**Pin 1 - How-To**
- Title: "How to [benefit]"
- Description: Step-by-step focused
- Angle: Instructional

**Pin 2 - Quick Tips**
- Title: "[Number] Ways to [outcome]"
- Description: Benefits-focused
- Angle: Practical

**Pin 3 - Why It Matters**
- Title: "Why [topic] matters for [age group]"
- Description: Educational, research-backed
- Angle: Expert insight

**Pin 4 - Question Hook**
- Title: "Is your [child] [problem]?"
- Description: Problem-solution
- Angle: Relatable/emotional

**Pin 5 - Evergreen**
- Title: "[Topic] Guide for [age group]"
- Description: Comprehensive overview
- Angle: Reference/bookmark

### 4. Pin Tag Generator
**Purpose**: Suggest relevant tags for pins

**Process**:
1. Analyze article content
2. Extract key topics
3. Generate 8-12 Pinterest-friendly tags
4. Output as: reference list for manual copying

**Tag Categories**:
- **Parenting tags**: #parentingtips #parenthood #parentingadvice
- **Age-specific**: #toddlerlife #preschoolermom #newbornmom
- **Topic-specific**: Based on article content
- **Trend tags**: Seasonal/trending parenting topics

**Output Format** (for copy/paste):
```
Suggested tags for this pin:
#parentingtips #toddlerlife #parentingadvice #earlychildhood #momlife #parenting101 #toddleractivities #familytime #parentsofpinterest #babywearing
```

## Database/Storage for Pin Drafts

Since we need you to review pins before posting, we'll save them locally:

**Option A: JSON File Storage** (Simple)
```
saved_pins/
├── article_123_pin_1.json
├── article_123_pin_2.json
├── article_123_pin_3.json
└── ...
```

**Option B: SQLite Database** (More robust)
```
pins.db
├── pins table (id, article_id, title, description, status, created_at)
└── boards table (id, name, pinterest_id, created_at)
```

**Recommendation**: Start with JSON files, upgrade to database later if needed.

## Command Structure

### Generate Article + Image + Pins
```bash
npm run generate-full "Article Topic"
```

This will:
1. Generate article with ChatGPT
2. Generate featured image with DALL-E
3. Upload to WordPress as draft
4. Generate 5 pin variations
5. Save pins for review
6. Show review instructions

### Generate Pins from Existing Post
```bash
npm run generate-pins 123
```

Where 123 is the WordPress post ID

### Review & Approve Pins
```bash
npm run review-pins 123
```

Shows all pin drafts, lets you approve/modify

### Upload Approved Pins to Pinterest
```bash
npm run upload-pins 123
```

Creates board, uploads approved pins, outputs tag suggestions

## Setup Requirements

### API Keys Needed
- ✅ OpenAI (ChatGPT) - Already have
- ✅ OpenAI (DALL-E) - Already have (same account)
- 🔄 Pinterest API - Need to set up

### Pinterest Setup Steps
1. Go to https://developers.pinterest.com
2. Create developer account
3. Create application
4. Get OAuth credentials
5. Connect to your ParentVillage Pinterest account
6. Grant permissions

### Environment Variables (`.env`)
```
# Existing
WORDPRESS_URL=...
WORDPRESS_USERNAME=...
WORDPRESS_PASSWORD=...
OPENAI_API_KEY=...

# New for Pinterest
PINTEREST_APP_ID=your_app_id
PINTEREST_APP_SECRET=your_app_secret
PINTEREST_ACCESS_TOKEN=your_access_token

# Image generation
IMAGE_GENERATION_ENABLED=true
DEFAULT_BOARD_NAME=Blog Content  # Used when creating new boards
```

## Tag Strategy for Pinterest

Since Pinterest API doesn't support auto-tagging, here's our approach:

### Standard Tags (Always Used)
```
#parentingtips #parenthood #parentingadvice #earlychildhood
```

### Dynamic Tags (Generated per article)
```
Generated based on article topics, age groups, and keywords
```

### Your Workflow
1. Generate pins
2. Review pin content
3. Approve for Pinterest
4. System outputs tag suggestions
5. You copy/paste into Pinterest admin when uploading

### Alternative: Pre-Defined Tag Set
If you want consistency, we can use the same tags for all pins.

## Implementation Phases

### Phase 1: Image Generation (Before Pinterest)
- ✅ Build DALL-E image generation service
- ✅ Integrate with article generation
- ✅ Save images to WordPress
- Test with 2-3 articles

### Phase 2: Pinterest Core
- Set up Pinterest developer account
- Build Pinterest service
- Create pin generation command
- Implement pin review system

### Phase 3: Full Automation
- Create "generate-full" command
- Board creation automation
- Tag suggestion system
- Publishing workflow

### Phase 4: Analytics & Optimization
- Track pin performance
- Optimize based on engagement
- A/B test different pin variations
- Adjust image generation prompts

## Quality Assurance Checklist

Before uploading pins to Pinterest, verify:
- ✓ Image quality and brand match
- ✓ Pin title is clear and compelling
- ✓ Description has call-to-action
- ✓ Link correctly points to blog post
- ✓ Alt text describes image accurately
- ✓ No spelling/grammar errors
- ✓ Relevant to Parent Village audience
- ✓ Board name is appropriate

## Next Steps

1. Decide on JSON vs Database storage for pin drafts
2. Set up Pinterest developer account
3. Create image generation service with brand guidelines
4. Build pin generation and review system
5. Test full workflow with 1-2 articles
6. Gather your feedback and optimize

---

**Note**: The full automation from article → image → pins → Pinterest can take 5-10 minutes per article due to API processing times (DALL-E image generation takes longest). Consider batching articles or generating overnight.
