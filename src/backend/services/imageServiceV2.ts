/**
 * Image Generation Service V2
 *
 * Clean rebuild with reliable approach:
 * 1. Gemini Imagen generates illustration (NO text)
 * 2. Sharp adds text overlay with precise control
 *
 * This separates concerns and gives us full control over text rendering.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Image dimensions
const WORDPRESS_WIDTH = 1024;
const WORDPRESS_HEIGHT = 1024;
const PINTEREST_WIDTH = 1000;
const PINTEREST_HEIGHT = 1500;

export interface GeneratedImage {
  localPath: string;
  width: number;
  height: number;
}

export interface ImageGenerationOptions {
  topic: string;
  type: 'wordpress' | 'pinterest';
  outputDir?: string;
}

export class ImageServiceV2 {
  private genAI: GoogleGenAI;
  private outputDir: string;

  constructor(outputDir: string = './generated_images') {
    this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || '' });
    this.outputDir = outputDir;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a complete image with illustration + text (all done by Gemini)
   */
  async generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> {
    const { topic, type } = options;
    const width = type === 'pinterest' ? PINTEREST_WIDTH : WORDPRESS_WIDTH;
    const height = type === 'pinterest' ? PINTEREST_HEIGHT : WORDPRESS_HEIGHT;

    console.log(`\n🎨 Generating ${type} image for: "${topic}"`);

    // Generate complete image with Gemini (illustration + text)
    const shortTitle = this.createShortTitle(topic);
    const imageBuffer = await this.generateCompleteImage(topic, shortTitle, type);

    // Save to file
    const filename = this.generateFilename(topic, type);
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, imageBuffer);

    console.log(`   ✅ Image saved: ${filepath}\n`);

    return {
      localPath: filepath,
      width,
      height
    };
  }

  /**
   * Generate both WordPress and Pinterest images
   */
  async generateBothImages(topic: string): Promise<{ wordpress: GeneratedImage; pinterest: GeneratedImage }> {
    console.log(`\n🎨 Generating images for: "${topic}"`);

    const shortTitle = this.createShortTitle(topic);

    // Generate WordPress version (square)
    console.log('   Generating WordPress image...');
    const wpBuffer = await this.generateCompleteImage(topic, shortTitle, 'wordpress');
    const wpFilename = this.generateFilename(topic, 'wordpress');
    const wpPath = path.join(this.outputDir, wpFilename);
    fs.writeFileSync(wpPath, wpBuffer);

    // Generate Pinterest version (vertical) - separate generation for proper composition
    console.log('   Generating Pinterest image...');
    const pinBuffer = await this.generateCompleteImage(topic, shortTitle, 'pinterest');
    const pinFilename = this.generateFilename(topic, 'pinterest');
    const pinPath = path.join(this.outputDir, pinFilename);
    fs.writeFileSync(pinPath, pinBuffer);

    console.log(`   ✅ Both images saved\n`);

    return {
      wordpress: { localPath: wpPath, width: WORDPRESS_WIDTH, height: WORDPRESS_HEIGHT },
      pinterest: { localPath: pinPath, width: PINTEREST_WIDTH, height: PINTEREST_HEIGHT }
    };
  }

  /**
   * Generate complete image with illustration AND text using Gemini
   */
  private async generateCompleteImage(topic: string, title: string, type: 'wordpress' | 'pinterest'): Promise<Buffer> {
    const isPinterest = type === 'pinterest';
    const aspectRatio = isPinterest ? '9:16 vertical (1000x1500 pixels)' : '1:1 square (1024x1024 pixels)';

    const prompt = `Create a complete Pinterest pin image for a parenting blog.

IMAGE SPECIFICATIONS:
- Aspect ratio: ${aspectRatio}
- This is the FINAL image - include ALL text and design elements

SCENE TO ILLUSTRATE:
${this.getSceneForTopic(topic)}

TEXT TO INCLUDE (use these EXACT words):
- Main title: "${title}" - large, bold, dark teal color (#2D5A4A), positioned in the upper portion
- Footer text: "Made With Love by Parentvillage.blog" - small, italic, at the very bottom

STYLE REQUIREMENTS:
- Modern flat vector illustration with soft subtle gradients
- Warm peachy/tan background (#F5E6D3)
- Characters wear muted orange/rust colored clothing
- Soft blue accents, warm brown hair tones
- Characters have realistic proportions, simple friendly faces, no harsh black outlines
- Small decorative elements: tiny hearts, relevant icons scattered around
- Professional, warm, nurturing mood

LAYOUT:
- Title text in the TOP portion of the image, well-spaced and readable
- Illustration of parent and child in the CENTER and LOWER portion
- Footer/watermark at the VERY BOTTOM
- Text should have good contrast and be easy to read

Generate the complete, final Pinterest-ready image.`;

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: prompt,
        config: {
          responseModalities: ['image', 'text'],
        }
      });

      // Find image part in response
      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        throw new Error('No response parts from Gemini');
      }

      for (const part of parts) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }

      throw new Error('No image data in Gemini response');
    } catch (error: any) {
      console.error('Gemini error:', error.message);
      throw error;
    }
  }

  /**
   * Convert topic to a parent-child scene description (for warm modern style)
   */
  private getSceneForTopic(topic: string): string {
    const lowerTopic = topic.toLowerCase();

    if (lowerTopic.includes('sleep') || lowerTopic.includes('bedtime')) return 'A mother sitting beside her toddler in bed, reading a bedtime story together';
    if (lowerTopic.includes('potty') || lowerTopic.includes('toilet')) return 'A parent kneeling next to a happy toddler who is proud of using the potty';
    if (lowerTopic.includes('food') || lowerTopic.includes('eating') || lowerTopic.includes('feeding')) return 'A mother feeding her baby in a high chair, both smiling';
    if (lowerTopic.includes('play') || lowerTopic.includes('toy')) return 'A parent and toddler sitting on the floor playing with blocks together';
    if (lowerTopic.includes('bath')) return 'A parent bathing a happy toddler with rubber ducks around';
    if (lowerTopic.includes('read') || lowerTopic.includes('book')) return 'A mother and child cuddled together reading a picture book';
    if (lowerTopic.includes('tantrum') || lowerTopic.includes('emotion') || lowerTopic.includes('discipline')) return 'A mother kneeling at child level, holding hands with her toddler, having a gentle conversation';
    if (lowerTopic.includes('sibling')) return 'A toddler gently hugging their baby sibling with a parent watching lovingly';
    if (lowerTopic.includes('walk') || lowerTopic.includes('outdoor')) return 'A parent holding hands with a toddler taking a walk in the park';

    return 'A mother and toddler sharing a warm, loving moment together';
  }

  /**
   * Create a short title from the topic (max 3 words, no truncation)
   */
  private createShortTitle(topic: string): string {
    const fillerWords = ['the', 'a', 'an', 'for', 'to', 'of', 'and', 'in', 'on', 'with', 'your', 'how', 'what', 'why', 'best', 'top', 'ultimate', 'complete', 'essential'];

    let words = topic
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => !fillerWords.includes(word) && word.length > 2);

    // Take first 3 meaningful words
    words = words.slice(0, 3);

    // Capitalize each word
    return words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Parenting Tips';
  }

  /**
   * Generate filename from topic
   */
  private generateFilename(topic: string, type: 'wordpress' | 'pinterest'): string {
    const prefix = type === 'pinterest' ? 'pin' : 'wp';
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
    const timestamp = Date.now();
    return `${prefix}_${slug}_${timestamp}.png`;
  }
}

export default ImageServiceV2;
