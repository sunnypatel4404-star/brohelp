# Bot Configuration Settings

## Overview
This document outlines all the parameters configured for your WordPress AI Agent based on analysis of your **Parent Village** blog.

## Writing Style Configuration

### Tone
- **Primary Tone**: Warm, conversational, and non-judgmental
- **Voice**: Like a knowledgeable friend (not an expert lecturing)
- **Approach**: Balanced between practical advice and emotional resonance

### Voice Characteristics
✅ Directly address readers as "you"
✅ Avoid clinical jargon, use accessible language
✅ Contemporary and evidence-based
✅ Inclusive and never judgmental
✅ Aspirational but achievable

## Article Parameters

### Length
- **Minimum**: 1,000 words
- **Maximum**: 1,200 words
- **Rationale**: Medium-length articles that are comprehensive but digestible

### Content Elements Required
1. **Practical, actionable tips** - Parents can implement immediately
2. **Research-based insights** - Modern evidence-based approaches
3. **Real-life examples** - Concrete scenarios and specific recommendations
4. **Age-segmented advice** - Infants, toddlers, preschoolers (when applicable)
5. **Direct reader engagement** - Emotional connection and aspiration

## Publishing Schedule
- **Frequency**: Daily (1 article per day)
- **Status**: Auto-save as drafts initially (can be changed to auto-publish)

## Blog-Specific Formatting

### Emoji Usage
✅ **Enabled** - Include relevant emoji in article titles
- Examples: 🌱, 💻, 💰, 🌞, 🌿, 💛
- Purpose: Visual interest and quick topic identification

### Mom Tip Sections
✅ **Enabled** - Include 2-3 "💛 Mom Tip" callout sections
- Format: Heart emoji + "Mom Tip" + italicized concept + specific example
- Purpose: Highlight key takeaways in scannable format

### Call-to-Action
✅ **Enabled** - Include newsletter signup CTAs where appropriate

## Content Structure

### Article Format
1. **Title**: Emoji + benefit-driven headline
2. **Opening**:
   - Establish relevance with contemporary parenting context
   - Include compelling hook about observation or child behavior
   - Clear purpose statement
3. **Body**:
   - 5-7 main sections with benefit-focused headings
   - 3-5 bulleted tips per section
   - 2-3 "💛 Mom Tip" callouts distributed throughout
4. **Conclusion**:
   - Reframe premise with emotional weight
   - Shift from "how-to" to "why-it-matters"
   - End with aspirational language

### HTML Formatting
- Proper heading tags: `<h2>` for main sections, `<h3>` for subsections
- Paragraph tags: `<p>` with 2-4 sentences max per paragraph
- Bullet points: `<ul><li>` for actionable tips
- Italics: For key concepts and emphasis
- Emojis: Integrated naturally throughout

## Key Style Guidelines

### DO Include:
- Specific book titles and product recommendations
- Real dialogue examples
- Concrete, relatable scenarios
- References to "research shows" or "experts suggest"
- Specific age recommendations (e.g., "ages 2-4")
- Heartfelt, aspirational closing language

### AVOID:
- Overly formal or clinical language
- Lengthy paragraphs (keep them short!)
- Lecturing tone
- Unsourced claims
- Generic advice without examples
- Judgmental language about parenting choices

## Core Blog Themes
Based on your existing content, articles should focus on:
- Mindfulness and intentional parenting
- Modern parenting research and trends
- Practical skill-building for children
- Wellness-oriented child development
- Simple, manageable strategies

## Example Headline Styles
(Based on your actual blog posts)
- "💻 Beyond the Screen: How to Introduce Tech Thoughtfully for Ages 0–8"
- "🌱 Raising Eco-Conscious Kids: Simple Ways to Instill Green Habits in Early Childhood"
- "Mindful Mornings: How to Create a Calmer Start to Your Preschooler's Day 🌞"
- "Which Parenting Styles Actually Work in 2025: What Modern Research Says 🌿"
- "💰 Financial Fluency for Kids: How to Teach Saving, Spending & Giving Before Age 10"

## Configuration File Location
- **File**: `/src/config/botConfig.ts`
- **Can be modified**: Yes, edit this file to adjust any parameters

## Next Steps
1. Copy `.env.example` to `.env`
2. Add your WordPress and OpenAI credentials
3. Run: `npm run generate-article "Your Article Topic"`
4. Review the generated article
5. Adjust configuration as needed based on results
