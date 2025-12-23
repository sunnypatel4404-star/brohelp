import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { getDatabase } from '../database/database';
import { getImageConfig, ImageType } from '../config/imageConfig';

// Image generation provider type
export type ImageProvider = 'dalle' | 'gemini';

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
  private openaiClient: OpenAI;
  private geminiClient: GoogleGenAI | null = null;
  private imagesDirectory: string;
  private provider: ImageProvider;

  constructor(
    openaiApiKey: string,
    imagesDir: string = './generated_images',
    provider: ImageProvider = 'gemini' // Default to Gemini for better style
  ) {
    this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    this.imagesDirectory = imagesDir;
    this.provider = provider;

    // Initialize Gemini if API key is available
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (googleApiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: googleApiKey });
    } else if (provider === 'gemini') {
      console.warn('⚠️  GOOGLE_API_KEY not found, falling back to DALL-E');
      this.provider = 'dalle';
    }

    // Create images directory if it doesn't exist
    if (!fs.existsSync(this.imagesDirectory)) {
      fs.mkdirSync(this.imagesDirectory, { recursive: true });
    }
  }

  /**
   * Generate image using Gemini (Nano Banana)
   * Returns base64 image data
   */
  private async generateWithGemini(prompt: string): Promise<Buffer> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    console.log('🍌 Using Nano Banana (Gemini) for image generation...\n');

    const response = await this.geminiClient.models.generateContent({
      model: 'gemini-2.0-flash-exp-image-generation',
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error('No content returned from Gemini');
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }

    throw new Error('No image data returned from Gemini');
  }

  /**
   * Generate image using OpenAI
   * Tries gpt-image-1 (GPT-4o native) first, falls back to dall-e-3
   * Returns image URL
   */
  private async generateWithDalle(prompt: string, config: { size: string; quality: string; style: string }): Promise<string> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 1: Sending prompt to OpenAI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 PROMPT:\n');
    console.log(prompt);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Try gpt-image-1 first (better results), fall back to dall-e-3
    try {
      console.log('🎨 Trying gpt-image-1 (GPT-4o Image)...');

      // gpt-image-1 uses different size options: 1024x1024, 1024x1536, 1536x1024, auto
      let gptSize: '1024x1024' | '1024x1536' | '1536x1024' | 'auto' = '1024x1536';
      if (config.size === '1024x1024') gptSize = '1024x1024';
      else if (config.size === '1792x1024') gptSize = '1536x1024';

      const response = await this.openaiClient.images.generate({
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: gptSize,
        quality: 'high' as any
      });

      if (response.data?.[0]?.url) {
        console.log('✅ STEP 1 COMPLETE: Received image from gpt-image-1\n');
        return response.data[0].url;
      }
    } catch (error: any) {
      console.log(`⚠️  gpt-image-1 failed: ${error.message?.substring(0, 100)}`);
      console.log('🔄 Falling back to dall-e-3...\n');
    }

    // Fallback to dall-e-3
    const response = await this.openaiClient.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: config.size as '1024x1024' | '1024x1792' | '1792x1024',
      quality: config.quality as 'standard' | 'hd',
      style: config.style as 'vivid' | 'natural'
    });

    if (!response.data || !response.data[0] || !response.data[0].url) {
      throw new Error('No image URL returned from DALL-E');
    }

    console.log('✅ STEP 1 COMPLETE: Received image from dall-e-3\n');
    return response.data[0].url;
  }

  /**
   * Generate an on-brand illustration for an article
   * Style: ParentVillage Pastel Pinterest Style
   * Supports separate configurations for WordPress and Pinterest images
   */
  async generateArticleImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const { topic, articleContent, articleTitle: _articleTitle, imageType = 'wordpress' } = request;

    // Get configuration based on image type
    const config = getImageConfig(imageType);
    // Pass articleContent to generate more relevant, context-aware prompts
    const prompt = config.promptTemplate(topic, articleContent);

    try {
      const typeName = imageType === 'pinterest' ? 'Pinterest pin' : 'WordPress featured image';
      console.log(`🎨 Generating ${typeName} (${config.size}) with ${this.provider.toUpperCase()}...\n`);

      let localPath: string;
      let imageUrl: string;

      if (this.provider === 'gemini' && this.geminiClient) {
        // Generate with Gemini (Nano Banana)
        const imageBuffer = await this.generateWithGemini(prompt);
        localPath = await this.saveImageBuffer(imageBuffer, topic, imageType);
        imageUrl = `local://${localPath}`;
      } else {
        // Generate with DALL-E
        imageUrl = await this.generateWithDalle(prompt, config);
        localPath = await this.downloadAndSaveImage(imageUrl, topic, imageType);
      }

      // Add title overlay and branding to the image
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 STEP 4: Adding title overlay and branding');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Image type: ${imageType}`);
      console.log(`   Title: "${topic}"`);

      if (imageType === 'wordpress') {
        console.log('   Applying WordPress layout...');
        localPath = await this.addWordPressTitleOverlay(localPath, topic);
      } else {
        console.log('   Applying Pinterest layout...');
        localPath = await this.addPinterestTitleOverlay(localPath, topic);
      }
      console.log('✅ STEP 4 COMPLETE\n');

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
   * Save image buffer directly to file (for Gemini which returns base64)
   */
  private async saveImageBuffer(
    buffer: Buffer,
    topic: string,
    imageType: ImageType = 'wordpress'
  ): Promise<string> {
    // Create filename from topic with image type prefix
    const timestamp = Date.now();
    const sanitizedTopic = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 30);

    const typePrefix = imageType === 'pinterest' ? 'pin' : 'wp';
    const filename = `${typePrefix}_${sanitizedTopic}_${timestamp}.png`;
    const localPath = path.join(this.imagesDirectory, filename);

    // Gemini returns various sizes, resize to our target dimensions
    const targetWidth = 1024;
    const targetHeight = 1536; // Standard Pinterest 2:3 ratio

    await sharp(buffer)
      .resize(targetWidth, targetHeight, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(localPath);

    console.log(`📁 Image saved to: ${localPath}`);

    return localPath;
  }


  /**
   * Download image from URL and save to local directory
   */
  private async downloadAndSaveImage(
    imageUrl: string,
    topic: string,
    imageType: ImageType = 'wordpress'
  ): Promise<string> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 2: Downloading image from URL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      console.log(`   Downloaded ${buffer.byteLength} bytes`);

      // Create filename from topic with image type prefix
      const timestamp = Date.now();
      const sanitizedTopic = topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30);

      const typePrefix = imageType === 'pinterest' ? 'pin' : 'wp';
      const filename = `${typePrefix}_${sanitizedTopic}_${timestamp}.png`;
      const localPath = path.join(this.imagesDirectory, filename);

      // Save image temporarily
      fs.writeFileSync(localPath, Buffer.from(buffer));

      console.log(`📁 Image saved to: ${localPath}`);
      console.log('✅ STEP 2 COMPLETE: Image downloaded and saved\n');

      // Remove color palette squares if present
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 STEP 3: Cropping color palettes (if any)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      await this.removeColorPalettes(localPath);
      console.log('✅ STEP 3 COMPLETE\n');

      return localPath;
    } catch (error) {
      console.error('Error downloading/saving image:', error);
      throw error;
    }
  }

  /**
   * Remove color palette squares that DALL-E sometimes adds to the right side
   * DALL-E embeds palettes within the canvas, so we crop off the right ~18%
   */
  private async removeColorPalettes(imagePath: string): Promise<void> {
    try {
      const metadata = await sharp(imagePath).metadata();
      const width = metadata.width || 1024;
      const height = metadata.height || 1536;

      // For vertical images, crop off right side where palettes appear
      // Keep the leftmost ~88% to remove just the palette squares on the right
      if (width === 1024 && height >= 1500) {
        console.log(`🔧 Cropping potential color palettes from right edge...`);

        const targetWidth = Math.floor(width * 0.88); // Keep 88%, remove 12% from right

        await sharp(imagePath)
          .extract({
            left: 0,
            top: 0,
            width: targetWidth,
            height: height
          })
          .resize(1024, 1536, {
            fit: 'fill',
            position: 'left'
          })
          .toFile(imagePath + '.clean.png');

        // Replace original with cleaned version
        fs.unlinkSync(imagePath);
        fs.renameSync(imagePath + '.clean.png', imagePath);

        console.log(`✓ Right edge cropped and image scaled back to 1024x1536`);
      }
    } catch (error) {
      // Non-critical, just log and continue
      console.log(`⚠️  Could not process palette removal: ${error}`);
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
   * Update WordPress URL for an image in the database
   */
  updateWordPressUrl(localPath: string, wordpressUrl: string): void {
    try {
      const db = getDatabase();
      const filename = path.basename(localPath);

      db.prepare(`
        UPDATE images
        SET wordpress_url = ?
        WHERE filename = ?
      `).run(wordpressUrl, filename);

      console.log(`📊 WordPress URL saved for ${filename}: ${wordpressUrl}`);
    } catch (error) {
      console.error('Warning: Failed to update WordPress URL:', error);
    }
  }

  /**
   * Add title and branding overlay to image
   * Crops top of image to remove Gemini text, adds cream header with our title
   */
  private async addPinterestTitleOverlay(imagePath: string, title: string): Promise<string> {
    try {
      const width = 1024;
      const height = 1536;
      const headerHeight = 180; // Cream header for our title
      const cropTop = 400; // Crop this much from top to remove Gemini text

      // Get short title from AI
      const shortTitle = await this.getShortTitle(title);
      console.log(`   Title: "${shortTitle}"`);

      // Split into max 2 lines
      const lines = this.splitTitle(shortTitle);

      // Fixed font size
      const fontSize = 58;
      const lineHeight = fontSize + 12;
      const titleY1 = 65;
      const titleY2 = titleY1 + lineHeight;
      const brandingY = height - 50;

      let titleSvg = '';
      if (lines.length === 1) {
        titleSvg = `<text x="${width/2}" y="${titleY1 + 25}" font-family="Verdana, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#2D5A5A" text-anchor="middle">${this.escapeXml(lines[0])}</text>`;
      } else {
        titleSvg = `
          <text x="${width/2}" y="${titleY1}" font-family="Verdana, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#2D5A5A" text-anchor="middle">${this.escapeXml(lines[0])}</text>
          <text x="${width/2}" y="${titleY2}" font-family="Verdana, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#2D5A5A" text-anchor="middle">${this.escapeXml(lines[1])}</text>
        `;
      }

      const footerHeight = 100;
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <!-- Cream header for our title -->
          <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="#F5F0E6"/>
          <!-- Cream footer for branding -->
          <rect x="0" y="${height - footerHeight}" width="${width}" height="${footerHeight}" fill="#F5F0E6"/>
          ${titleSvg}
          <text x="${width/2}" y="${brandingY}" font-family="Georgia, serif" font-size="28" fill="#2D5A5A" text-anchor="middle">Made With Love by Parentvillage.blog</text>
        </svg>
      `;

      // Get original dimensions
      const metadata = await sharp(imagePath).metadata();
      const origWidth = metadata.width || 1024;
      const origHeight = metadata.height || 1792;

      // Crop top portion (removes Gemini text) and resize illustration
      const croppedHeight = origHeight - cropTop;
      const illustrationHeight = height - headerHeight;

      const croppedImage = await sharp(imagePath)
        .extract({ left: 0, top: cropTop, width: origWidth, height: croppedHeight })
        .resize(width, illustrationHeight, { fit: 'cover', position: 'top' })
        .toBuffer();

      const finalPath = imagePath.replace('.png', '_final.png');

      // Compose: cream background + cropped illustration + title overlay
      await sharp({
        create: {
          width: width,
          height: height,
          channels: 4,
          background: { r: 245, g: 240, b: 230, alpha: 1 }
        }
      })
        .composite([
          { input: croppedImage, top: headerHeight, left: 0 },
          { input: Buffer.from(svg), top: 0, left: 0 }
        ])
        .png()
        .toFile(finalPath);

      fs.unlinkSync(imagePath);
      fs.renameSync(finalPath, imagePath);

      return imagePath;
    } catch (error) {
      console.error('Error adding overlay:', error);
      return imagePath;
    }
  }

  /**
   * Get a short 2-4 word title using AI
   */
  private async getShortTitle(title: string): Promise<string> {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Convert article titles to short Pinterest pin titles (2-4 words max, under 25 characters).
Keep the core meaning clear. Just output the short title, nothing else.

Examples:
"How to Help Your Child Navigate Difficult Emotions" -> "Kids & Emotions"
"The Power of Letting Kids Be Bored" -> "Let Kids Be Bored"
"Teaching Your Child to Share" -> "Teaching Sharing"
"Implementing Chores - A Guide" -> "Kids & Chores"
"Potty Training Tips for Toddlers" -> "Potty Training"
"Navigating Playdates" -> "Playdate Tips"`
          },
          { role: 'user', content: title }
        ],
        max_tokens: 15,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content?.trim() || title.split(' ').slice(0, 3).join(' ');
    } catch (error) {
      // Fallback: take first 3 words
      return title.split(' ').slice(0, 3).join(' ');
    }
  }

  /**
   * Split title into 1 or 2 lines
   */
  private splitTitle(title: string): string[] {
    if (title.length <= 15) {
      return [title];
    }
    // Split roughly in half at a space
    const mid = Math.floor(title.length / 2);
    const spaceAfter = title.indexOf(' ', mid);
    const spaceBefore = title.lastIndexOf(' ', mid);

    const splitPoint = (mid - spaceBefore) < (spaceAfter - mid) ? spaceBefore : spaceAfter;

    if (splitPoint === -1) {
      return [title];
    }

    return [title.substring(0, splitPoint), title.substring(splitPoint + 1)];
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }


  /**
   * Add WordPress-style title overlay - uses same logic as Pinterest
   */
  private async addWordPressTitleOverlay(imagePath: string, title: string): Promise<string> {
    // Use same function as Pinterest
    return this.addPinterestTitleOverlay(imagePath, title);
  }


  /**
   * Add watermark to image with "Made With Love By Parentvillage.blog" and yellow heart
   * @deprecated Use addTitleOverlay instead which adds both title and watermark
   */
  // @ts-ignore - kept for backwards compatibility
  private async addWatermark(imagePath: string): Promise<string> {
    try {
      // Create SVG text with watermark - overlay at bottom of existing image
      const watermarkText = 'Made With Love By Parentvillage.blog';

      // Get image dimensions first
      const metadata = await sharp(imagePath).metadata();
      const imageHeight = metadata.height || 1024;
      const imageWidth = metadata.width || 1024;

      // Create SVG overlay with text (positioned at bottom of existing image)
      const svgImage = `
        <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="${imageHeight - 80}" width="${imageWidth}" height="80" fill="rgba(255, 255, 255, 0.85)"/>
          <text x="${imageWidth / 2}" y="${imageHeight - 40}"
                font-family="Arial, sans-serif"
                font-size="28"
                font-weight="bold"
                fill="#a08c6b"
                text-anchor="middle"
                dominant-baseline="middle">
            ${watermarkText}
          </text>
          <text x="${imageWidth / 2 + 180}" y="${imageHeight - 40}"
                font-family="Arial, sans-serif"
                font-size="28"
                fill="#d4a574">
            ♥
          </text>
        </svg>
      `;

      // Compose the image with watermark overlay (no extension)
      const watermarkedPath = imagePath.replace('.png', '_watermarked.png');

      await sharp(imagePath)
        .composite([
          {
            input: Buffer.from(svgImage),
            top: 0,
            left: 0
          }
        ])
        .toFile(watermarkedPath);

      // Replace original with watermarked version
      fs.unlinkSync(imagePath);
      fs.renameSync(watermarkedPath, imagePath);

      return imagePath;
    } catch (error) {
      console.error('Error adding watermark:', error);
      // If watermark fails, return original image
      return imagePath;
    }
  }

  /**
   * Generate both WordPress and Pinterest images from a single Pinterest generation
   * This ensures perfect consistency between the two formats
   */
  async generateBothImages(request: ImageGenerationRequest): Promise<{
    wordpress: GeneratedImage;
    pinterest: GeneratedImage;
  }> {
    const { topic, articleContent, articleTitle } = request;

    // Generate Pinterest image (vertical 1024x1792)
    console.log(`🎨 Generating Pinterest pin image with ${this.provider.toUpperCase()} (will be used for both formats)...\n`);

    const pinterestConfig = getImageConfig('pinterest');
    // Pass articleContent for more relevant, context-aware image prompts
    const prompt = pinterestConfig.promptTemplate(topic, articleContent);

    try {
      let pinterestPath: string;
      let imageUrl: string;

      if (this.provider === 'gemini' && this.geminiClient) {
        // Generate with Gemini (Nano Banana)
        const imageBuffer = await this.generateWithGemini(prompt);
        pinterestPath = await this.saveImageBuffer(imageBuffer, topic, 'pinterest');
        imageUrl = `local://${pinterestPath}`;
      } else {
        // Generate with DALL-E
        imageUrl = await this.generateWithDalle(prompt, pinterestConfig);
        pinterestPath = await this.downloadAndSaveImage(imageUrl, topic, 'pinterest');
      }

      // Create WordPress copy BEFORE adding any overlays (so both start from clean base)
      console.log('📋 Creating WordPress version from base image...\n');
      const timestamp = Date.now();
      const sanitizedTopic = topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30);
      const wpFilename = `wp_${sanitizedTopic}_${timestamp}.png`;
      let wordpressPath = path.join(this.imagesDirectory, wpFilename);

      // Copy the BASE image (no overlays yet) for WordPress
      fs.copyFileSync(pinterestPath, wordpressPath);

      // Now add Pinterest-style title overlay to Pinterest image
      console.log('📌 Adding Pinterest title overlay...\n');
      pinterestPath = await this.addPinterestTitleOverlay(pinterestPath, articleTitle || topic);

      // Save Pinterest metadata to database
      this.saveImageMetadata(pinterestPath, topic, prompt);

      // Add title overlay to WordPress version (includes branding)
      console.log('📝 Adding title overlay to WordPress image...\n');
      wordpressPath = await this.addWordPressTitleOverlay(wordpressPath, articleTitle || topic);

      // Save WordPress metadata to database
      this.saveImageMetadata(wordpressPath, topic, prompt);

      console.log(`✅ Both images generated successfully from single source!`);
      console.log(`   Pinterest: ${pinterestPath}`);
      console.log(`   WordPress: ${wordpressPath}\n`);

      return {
        pinterest: {
          url: imageUrl,
          localPath: pinterestPath,
          prompt: prompt,
          imageType: 'pinterest'
        },
        wordpress: {
          url: imageUrl,
          localPath: wordpressPath,
          prompt: prompt,
          imageType: 'wordpress'
        }
      };
    } catch (error) {
      console.error('Error generating images:', error);
      throw error;
    }
  }
}
