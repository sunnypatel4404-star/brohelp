import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { getDatabase } from '../database/database';
import { getImageConfig, ImageType } from '../config/imageConfig';

interface ImageGenerationRequest {
  topic: string;
  articleContent?: string;
  articleTitle?: string;
  imageType?: ImageType; // 'wordpress' or 'pinterest'
}

interface GeneratedImage {
  url: string;
  localPath: string;
  prompt: string;
  imageType: ImageType;
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
   * Style: ParentVillage Pastel Pinterest Style
   * Supports separate configurations for WordPress and Pinterest images
   */
  async generateArticleImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const { topic, articleTitle, imageType = 'wordpress' } = request;

    // Get configuration based on image type
    const config = getImageConfig(imageType);
    const prompt = config.promptTemplate(topic, articleTitle);

    try {
      const typeName = imageType === 'pinterest' ? 'Pinterest pin' : 'WordPress featured image';
      console.log(`🎨 Generating ${typeName} (${config.size})...\n`);

      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: config.size,
        quality: config.quality,
        style: config.style
      });

      if (!response.data || !response.data[0] || !response.data[0].url) {
        throw new Error('No image URL returned from DALL-E');
      }

      const imageUrl = response.data[0].url;

      // Download and save image locally
      let localPath = await this.downloadAndSaveImage(imageUrl, topic, imageType);

      // Add watermark to the image (only for WordPress images, Pinterest has it in the prompt)
      if (imageType === 'wordpress') {
        console.log('💛 Adding watermark...\n');
        localPath = await this.addWatermark(localPath);
      } else {
        console.log('💛 Watermark included in Pinterest design...\n');
      }

      // Save image metadata to database
      this.saveImageMetadata(localPath, topic, prompt);

      console.log(`✓ ${typeName} generated and saved`);

      return {
        url: imageUrl,
        localPath: localPath,
        prompt: prompt,
        imageType: imageType
      };
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }


  /**
   * Download image from URL and save to local directory
   */
  private async downloadAndSaveImage(
    imageUrl: string,
    topic: string,
    imageType: ImageType = 'wordpress'
  ): Promise<string> {
    try {
      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // Create filename from topic with image type prefix
      const timestamp = Date.now();
      const sanitizedTopic = topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30);

      const typePrefix = imageType === 'pinterest' ? 'pin' : 'wp';
      const filename = `${typePrefix}_${sanitizedTopic}_${timestamp}.png`;
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
