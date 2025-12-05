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
    provider: ImageProvider = 'gemini' // Default to Nano Banana (Gemini)
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
    const { topic, articleTitle: _articleTitle, imageType = 'wordpress' } = request;

    // Get configuration based on image type
    const config = getImageConfig(imageType);
    const prompt = config.promptTemplate(topic);

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
   * Add Pinterest-style title overlay to vertical pin image
   * Just title text - no watermark, no background box
   */
  private async addPinterestTitleOverlay(imagePath: string, title: string): Promise<string> {
    try {
      const width = 1024;
      const height = 1536; // Standard Pinterest 2:3 ratio

      // Extract the core topic from the title
      const displayTitle = this.extractCoreTitle(title);

      // Wrap text - allow more chars per line for meaningful titles
      const { lines } = this.wrapText(displayTitle, 20);

      // Title position - moved down closer to illustration
      const topMargin = 350;
      const lineHeight = 110;

      // Create title text lines
      const textContent = lines.map((line, i) =>
        `<tspan x="${width / 2}" y="${topMargin + (i * lineHeight)}">${this.escapeXml(line)}</tspan>`
      ).join('');

      // Create overlay with title and branding
      const overlaySVG = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <!-- White glow behind text for readability -->
            <filter id="textGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feFlood flood-color="#ffffff" flood-opacity="0.9"/>
              <feComposite in2="SourceAlpha" operator="in"/>
              <feGaussianBlur stdDeviation="8"/>
              <feComposite in="SourceGraphic"/>
            </filter>
          </defs>

          <!-- Title text - dark teal, large and bold -->
          <text font-family="'Georgia', 'Playfair Display', serif"
                font-size="100"
                font-weight="700"
                fill="#2D5A5A"
                text-anchor="middle"
                filter="url(#textGlow)">
            ${textContent}
          </text>

          <!-- Branding at bottom -->
          <text x="${width / 2}" y="${height - 60}"
                font-family="'Georgia', serif"
                font-size="32"
                fill="#2D5A5A"
                text-anchor="middle"
                filter="url(#textGlow)">
            Made With Love by Parentvillage.blog
          </text>
        </svg>
      `;

      const finalPath = imagePath.replace('.png', '_final.png');

      // Resize illustration to fill entire canvas, then overlay text on top
      await sharp(imagePath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .composite([
          {
            input: Buffer.from(overlaySVG),
            top: 0,
            left: 0
          }
        ])
        .toFile(finalPath);

      // Replace original with final version
      fs.unlinkSync(imagePath);
      fs.renameSync(finalPath, imagePath);

      console.log(`✓ Added Pinterest title and branding: "${displayTitle}"`);
      return imagePath;
    } catch (error) {
      console.error('Error adding Pinterest overlay:', error);
      return imagePath;
    }
  }

  /**
   * Escape special XML characters in text
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Extract a clean, purposeful title (3-6 words ideal)
   * Keeps titles meaningful and complete
   * "Teaching Kids Manners" -> "Teaching Kids Manners" (keep as-is)
   * "Everything You Need to Know About Starting Preschool" -> "Starting Preschool"
   */
  private extractCoreTitle(title: string): string {
    // Remove emojis
    let clean = title
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .trim();

    // Only strip very long filler phrases at the start
    const longFillerPhrases = [
      /^everything you need to know about\s+/i,
      /^what you need to know about\s+/i,
      /^the ultimate guide to\s+/i,
      /^the complete guide to\s+/i,
      /^a parent'?s guide to\s+/i,
      /^the parent'?s guide to\s+/i,
      /^the importance of\s+/i,
      /^why you should\s+/i,
      /^how to\s+/i,
    ];

    for (const phrase of longFillerPhrases) {
      clean = clean.replace(phrase, '');
    }

    // Remove trailing qualifiers that add length without value
    clean = clean
      .replace(/:\s*a parent'?s guide$/i, '')
      .replace(/:\s*what every parent.*$/i, '')
      .replace(/\s*-\s*a complete guide$/i, '')
      .trim();

    // Capitalize first letter of each word (but keep small words lowercase)
    const smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'of', 'in'];
    clean = clean.split(' ')
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (index > 0 && smallWords.includes(lower)) {
          return lower;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');

    // If more than 5 words, trim to first 5
    const words = clean.split(/\s+/);
    if (words.length > 5) {
      clean = words.slice(0, 5).join(' ');
    }

    return clean || 'Parenting Tips';
  }

  /**
   * Wrap text for SVG multi-line display (simple word wrap)
   * Returns object with lines array and total line count for proper positioning
   */
  private wrapText(text: string, maxChars: number): { lines: string[], lineCount: number } {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length > maxChars && currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });

    if (currentLine.trim().length > 0) {
      lines.push(currentLine.trim());
    }

    return { lines, lineCount: lines.length };
  }

  /**
   * Add WordPress-style title overlay to blog image
   * Just title text - no watermark, no background box
   */
  private async addWordPressTitleOverlay(imagePath: string, title: string): Promise<string> {
    try {
      const width = 1024;
      const height = 1536; // Standard Pinterest 2:3 ratio

      // Extract the core topic from the title
      const displayTitle = this.extractCoreTitle(title);

      // Wrap text - allow more chars per line for meaningful titles
      const { lines } = this.wrapText(displayTitle, 20);

      // Title position - moved down closer to illustration
      const topMargin = 350;
      const lineHeight = 110;

      // Create title text lines
      const textContent = lines.map((line, i) =>
        `<tspan x="${width / 2}" y="${topMargin + (i * lineHeight)}">${this.escapeXml(line)}</tspan>`
      ).join('');

      // Create overlay with title and branding
      const overlaySVG = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <!-- White glow behind text for readability -->
            <filter id="textGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feFlood flood-color="#ffffff" flood-opacity="0.9"/>
              <feComposite in2="SourceAlpha" operator="in"/>
              <feGaussianBlur stdDeviation="8"/>
              <feComposite in="SourceGraphic"/>
            </filter>
          </defs>

          <!-- Title text - dark teal, large and bold -->
          <text font-family="'Georgia', 'Playfair Display', serif"
                font-size="100"
                font-weight="700"
                fill="#2D5A5A"
                text-anchor="middle"
                filter="url(#textGlow)">
            ${textContent}
          </text>

          <!-- Branding at bottom -->
          <text x="${width / 2}" y="${height - 60}"
                font-family="'Georgia', serif"
                font-size="32"
                fill="#2D5A5A"
                text-anchor="middle"
                filter="url(#textGlow)">
            Made With Love by Parentvillage.blog
          </text>
        </svg>
      `;

      const finalPath = imagePath.replace('.png', '_final.png');

      // Resize illustration to fill entire canvas, then overlay text on top
      await sharp(imagePath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .composite([
          {
            input: Buffer.from(overlaySVG),
            top: 0,
            left: 0
          }
        ])
        .toFile(finalPath);

      // Replace original with final version
      fs.unlinkSync(imagePath);
      fs.renameSync(finalPath, imagePath);

      console.log(`✓ Added WordPress title and branding: "${displayTitle}"`);
      return imagePath;
    } catch (error) {
      console.error('Error adding WordPress overlay:', error);
      return imagePath;
    }
  }

  /**
   * Add watermark to image with "Made With Love By Parentvillage.blog" and yellow heart
   */
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
    const { topic, articleTitle } = request;

    // Generate Pinterest image (vertical 1024x1792)
    console.log(`🎨 Generating Pinterest pin image with ${this.provider.toUpperCase()} (will be used for both formats)...\n`);

    const pinterestConfig = getImageConfig('pinterest');
    const prompt = pinterestConfig.promptTemplate(topic);

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
