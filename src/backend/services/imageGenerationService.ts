import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { getDatabase } from '../database/database';

interface ImageGenerationRequest {
  topic: string;
  articleContent?: string;
  articleTitle?: string;
}

interface GeneratedImage {
  url: string;
  localPath: string;
  prompt: string;
}

export class ImageGenerationService {
  private client: OpenAI;
  private imagesDirectory: string;

  constructor(apiKey: string, imagesDir: string = './generated_images') {
    this.client = new OpenAI({ apiKey });
    this.imagesDirectory = imagesDir;

    // Create images directory if it doesn't exist
    if (!fs.existsSync(this.imagesDirectory)) {
      fs.mkdirSync(this.imagesDirectory, { recursive: true });
    }
  }

  /**
   * Generate an on-brand illustration for an article
   * Style: Flat design, vector illustrations with pastel + warm earth tones
   */
  async generateArticleImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const { topic, articleTitle } = request;

    const prompt = this.buildPrompt(topic, articleTitle);

    try {
      console.log('🎨 Generating on-brand illustration...\n');

      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024', // DALL-E 3 generates 1024x1024, we'll note for Pinterest aspect ratio
        quality: 'standard',
        style: 'natural'
      });

      if (!response.data || !response.data[0] || !response.data[0].url) {
        throw new Error('No image URL returned from DALL-E');
      }

      const imageUrl = response.data[0].url;

      // Download and save image locally
      let localPath = await this.downloadAndSaveImage(imageUrl, topic);

      // Add watermark to the image
      console.log('💛 Adding watermark...\n');
      localPath = await this.addWatermark(localPath);

      // Save image metadata to database
      this.saveImageMetadata(localPath, topic, prompt);

      console.log(`✓ Image generated and saved with watermark`);

      return {
        url: imageUrl,
        localPath: localPath,
        prompt: prompt
      };
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  /**
   * Build detailed prompt for DALL-E based on Parent Village brand guidelines
   */
  private buildPrompt(topic: string, articleTitle?: string): string {
    const titlePart = articleTitle ? `about "${articleTitle}"` : `about "${topic}"`;

    return `Create a flat design illustration for a parenting blog article ${titlePart}.

CRITICAL STYLE REQUIREMENTS:
- Flat design, vector illustration style (NOT photorealistic)
- Warm, inviting, child-friendly aesthetic
- Color palette MUST include: Soft pastels (pastel pinks, soft blues, soft greens, soft yellows) combined with warm earth tones (beiges, warm browns, soft oranges)
- Simple, minimalist composition with clean lines
- Include happy, relatable people (parents, children) or relevant activity scenes
- Characters should be diverse and inclusive
- Perfect for Pinterest pins (1000x1500px aspect ratio - design for vertical orientation)
- Accessible and welcoming to all parents

WATERMARK REQUIREMENT (IMPORTANT):
- Add text at the bottom center of the image: "Made With Love By Parentvillage.blog"
- Use a soft, friendly sans-serif font
- Place a yellow heart emoji (💛) next to the text
- Use soft colors that blend with the pastel palette (soft beige or light brown for text)
- Keep watermark subtle but visible

DESIGN ELEMENTS:
- Simple geometric shapes
- Subtle shadows for depth
- Friendly, rounded corners
- Child-safe, age-appropriate imagery
- Calming, peaceful atmosphere

DO NOT include:
- Photorealistic images or photographs
- Overly complex designs or busy layouts
- Bright primary colors (use pastels instead)
- Professional/clinical appearance
- Medical imagery or technical diagrams
- Dark or scary elements
- Cluttered backgrounds

Make it suitable for a parenting and early childhood education audience. The illustration should be warm, professional yet approachable, and visually similar to modern parenting blog aesthetics.`;
  }

  /**
   * Download image from URL and save to local directory
   */
  private async downloadAndSaveImage(
    imageUrl: string,
    topic: string
  ): Promise<string> {
    try {
      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // Create filename from topic
      const timestamp = Date.now();
      const sanitizedTopic = topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30);

      const filename = `${sanitizedTopic}_${timestamp}.png`;
      const localPath = path.join(this.imagesDirectory, filename);

      // Save image
      fs.writeFileSync(localPath, Buffer.from(buffer));

      console.log(`📁 Image saved to: ${localPath}`);

      return localPath;
    } catch (error) {
      console.error('Error downloading/saving image:', error);
      throw error;
    }
  }

  /**
   * Get info about generated images directory
   */
  getImagesDirectory(): string {
    return this.imagesDirectory;
  }

  /**
   * List all generated images
   */
  listGeneratedImages(): string[] {
    try {
      return fs.readdirSync(this.imagesDirectory).filter(file =>
        file.endsWith('.png')
      );
    } catch (error) {
      console.error('Error listing images:', error);
      return [];
    }
  }

  /**
   * Save image metadata to database
   */
  private saveImageMetadata(localPath: string, topic: string, _prompt?: string): void {
    try {
      const db = getDatabase();
      const filename = path.basename(localPath);
      const stats = fs.statSync(localPath);

      db.prepare(`
        INSERT INTO images (filename, topic, local_path, created_at, file_size)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        filename,
        topic,
        localPath,
        new Date().toISOString(),
        stats.size
      );

      console.log(`📊 Image metadata saved to database: ${filename}`);
    } catch (error) {
      // Log but don't fail - metadata is supplementary
      console.error('Warning: Failed to save image metadata:', error);
    }
  }

  /**
   * Add watermark to image with "Made With Love By Parentvillage.blog" and yellow heart
   */
  private async addWatermark(imagePath: string): Promise<string> {
    try {
      // Create SVG text with watermark
      const watermarkText = 'Made With Love By Parentvillage.blog 💛';

      // Create SVG overlay with text
      const svgImage = `
        <svg width="1024" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="1024" height="100" fill="rgba(255, 255, 255, 0.85)"/>
          <text x="512" y="60"
                font-family="Arial, sans-serif"
                font-size="32"
                font-weight="bold"
                fill="#a08c6b"
                text-anchor="middle"
                dominant-baseline="middle">
            ${watermarkText}
          </text>
        </svg>
      `;

      // Write SVG to temporary file
      const svgPath = imagePath.replace('.png', '_watermark.svg');
      fs.writeFileSync(svgPath, svgImage);

      // Compose the image with watermark at bottom
      const watermarkedPath = imagePath.replace('.png', '_watermarked.png');

      await sharp(imagePath)
        .extend({
          top: 0,
          bottom: 100,
          left: 0,
          right: 0,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .composite([
          {
            input: Buffer.from(svgImage),
            top: 1024, // Position at bottom (original height is 1024)
            left: 0
          }
        ])
        .toFile(watermarkedPath);

      // Replace original with watermarked version
      fs.unlinkSync(imagePath);
      fs.renameSync(watermarkedPath, imagePath);

      // Clean up SVG file
      if (fs.existsSync(svgPath)) {
        fs.unlinkSync(svgPath);
      }

      return imagePath;
    } catch (error) {
      console.error('Error adding watermark:', error);
      // If watermark fails, return original image
      return imagePath;
    }
  }
}
