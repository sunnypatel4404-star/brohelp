/**
 * Image Generation Configuration
 * Defines separate parameters for WordPress featured images and Pinterest pin images
 */

export type ImageType = 'wordpress' | 'pinterest';

export interface ImageGenerationConfig {
  size: '1024x1024' | '1024x1792' | '1792x1024';
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
  promptTemplate: (topic: string, articleTitle?: string) => string;
}

/**
 * ParentVillage Pastel Pinterest Style Configuration
 *
 * STYLE REQUIREMENTS:
 * - Flat illustration style (no gradients, no photorealism, no harsh shadows)
 * - Soft pastel color palette (gentle pinks, baby blues, mint, lavender, peach, cream, butter yellow)
 * - Rounded, friendly character design (children's book aesthetic)
 * - Minimal shading, minimal texture
 * - Clean bright background with lots of negative space
 * - Soft, low-contrast line art (brown or muted purple preferred)
 * - Pinterest vertical format (2:3 aspect ratio)
 * - Large, clean title text at the top in rounded or playful font
 * - Main illustration in the center
 * - Small branding text "ParentVillage.blog" at the bottom
 *
 * Overall vibe: warm, cheerful, mom-friendly, gentle, pastel, modern, minimalist, inviting
 */

/**
 * Pinterest Pin Image Configuration
 * Optimized for Pinterest 2:3 aspect ratio (1024x1792)
 */
export const pinterestImageConfig: ImageGenerationConfig = {
  size: '1024x1792', // Vertical Pinterest format (2:3 ratio)
  quality: 'hd', // Higher quality for Pinterest pins
  style: 'natural', // More consistent with flat illustration style

  promptTemplate: (topic: string, articleTitle?: string) => {
    const titlePart = articleTitle ? `"${articleTitle}"` : `"${topic}"`;

    return `Create ONE vertical Pinterest pin showing the EXACT scenario from this article title: ${titlePart}

WHAT TO SHOW (MOST IMPORTANT):
Depict the specific activity/concept from ${titlePart} with 1-2 characters (mother and/or child) actually doing what the title describes. The illustration must directly represent this exact topic - no random parenting imagery.

CHARACTERS:
1-2 people with normal human skin tones (diverse representation - various realistic skin tones from light to dark). Simple rounded shapes, friendly expressions, children's book style.

VISUAL STYLE:
Soft pastel flat illustration (children's book style), gentle pinks/blues/mint/lavender/cream backgrounds, simple rounded shapes, minimal shading, warm calming aesthetic. ONE unified vertical scene (NOT a grid/panels/mosaic).

TEXT ON IMAGE:
- TOP: Article title "${articleTitle || topic}" overlaid on image (large, bold, clear font, soft brown/purple color)
- BOTTOM: "ParentVillage.blog" branding text (small, subtle)
- Can include relevant emoji with title

Keep it simple: 1-2 characters with normal skin tones, clean background, vertical layout, lots of negative space, warm friendly vibe, directly showing what the title says.`;
  }
};

/**
 * WordPress Featured Image Configuration
 * Optimized for blog featured images (square or landscape)
 */
export const wordpressImageConfig: ImageGenerationConfig = {
  size: '1024x1024', // Square format for WordPress featured images
  quality: 'standard', // Standard quality is sufficient for WordPress
  style: 'natural',

  promptTemplate: (topic: string, articleTitle?: string) => {
    const titlePart = articleTitle ? `"${articleTitle}"` : `"${topic}"`;

    return `Create ONE single illustration showing the EXACT scenario from this article title: ${titlePart}

WHAT TO SHOW (MOST IMPORTANT):
Depict the specific activity/concept from the title ${titlePart} with 1-2 characters (mother and/or child) actually doing what the title describes. The scene must directly represent this exact topic - no random parenting imagery.

CHARACTERS:
1-2 people with normal human skin tones (diverse representation - various realistic skin tones from light to dark). Simple rounded shapes, friendly expressions, children's book style.

VISUAL STYLE:
Soft pastel flat illustration (children's book style), gentle pinks/blues/mint/lavender/cream backgrounds, simple rounded shapes, minimal shading, warm calming aesthetic matching ParentVillage.blog. ONE unified scene (NOT a grid/panels/mosaic).

TEXT ON IMAGE:
Add the article title "${articleTitle || topic}" as text overlay centered on the image. Use clear sans-serif font, soft brown or muted color, large and readable. Can include relevant emoji.

Keep it simple: 1-2 characters with normal skin tones, clean background, lots of negative space, warm friendly vibe, directly showing what the title says.`;
  }
};

/**
 * Get image configuration based on image type
 */
export function getImageConfig(type: ImageType): ImageGenerationConfig {
  switch (type) {
    case 'pinterest':
      return pinterestImageConfig;
    case 'wordpress':
      return wordpressImageConfig;
    default:
      return wordpressImageConfig;
  }
}

/**
 * Image type metadata
 */
export const imageTypeMetadata = {
  wordpress: {
    name: 'WordPress Featured Image',
    description: 'Square format optimized for blog featured images',
    aspectRatio: '1:1',
    dimensions: '1024x1024',
    useCase: 'Blog header and featured image'
  },
  pinterest: {
    name: 'Pinterest Pin',
    description: 'Vertical format optimized for Pinterest',
    aspectRatio: '2:3',
    dimensions: '1024x1792',
    useCase: 'Pinterest pin sharing and promotion'
  }
} as const;
