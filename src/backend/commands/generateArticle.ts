import dotenv from 'dotenv';
import * as path from 'path';
import { ChatGPTService } from '../services/chatgptService';
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService';
import { ImageServiceV2 } from '../services/imageServiceV2';
import { PinGenerationService } from '../services/pinGenerationService';
import { PinStorageService } from '../services/pinStorageService';
import { InternalLinkingService } from '../services/internalLinkingService';
import { parentVillageBotConfig } from '../config/botConfig';

dotenv.config();

// Validate and sanitize topic input
function validateTopic(topic: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!topic || typeof topic !== 'string') {
    return { valid: false, error: 'Topic is required' };
  }

  const trimmed = topic.trim();

  if (trimmed.length < 5) {
    return { valid: false, error: 'Topic must be at least 5 characters long' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Topic must be less than 500 characters' };
  }

  // Check for potentially malicious content (basic sanitization)
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /on\w+=/i,  // onclick=, onerror=, etc.
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Topic contains invalid characters' };
    }
  }

  // Sanitize: remove any HTML tags and excessive whitespace
  const sanitized = trimmed
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { valid: true, sanitized };
}

async function main() {
  const wordpressUrl = process.env.WORDPRESS_URL;
  const wordpressUsername = process.env.WORDPRESS_USERNAME;
  const wordpressPassword = process.env.WORDPRESS_PASSWORD;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  // Validate environment variables
  if (!wordpressUrl || !wordpressUsername || !wordpressPassword) {
    console.error('❌ Missing WordPress configuration in .env file');
    console.error('Please set WORDPRESS_URL, WORDPRESS_USERNAME, and WORDPRESS_PASSWORD');
    process.exit(1);
  }

  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env file');
    process.exit(1);
  }

  // Validate topic input
  const rawTopic = process.argv[2] || 'Building independence in toddlers through daily routines';
  const validation = validateTopic(rawTopic);

  if (!validation.valid) {
    console.error(`❌ Invalid topic: ${validation.error}`);
    process.exit(1);
  }

  const topic = validation.sanitized!;

  try {
    console.log('🚀 Starting article + image generation...\n');

    // Initialize services with bot configuration
    const chatgpt = new ChatGPTService(openaiApiKey, parentVillageBotConfig);
    const wordpress = new WordPressXmlRpcService(wordpressUrl, wordpressUsername, wordpressPassword);
    const imageService = new ImageServiceV2('./generated_images');
    const internalLinking = new InternalLinkingService(wordpress);

    console.log(`📝 Generating article about: "${topic}"\n`);
    console.log(`Configuration: ${parentVillageBotConfig.publishingFrequency} publishing, ${parentVillageBotConfig.wordCountMin}-${parentVillageBotConfig.wordCountMax} words\n`);

    // Fetch existing articles for internal linking
    const internalLinkingInstructions = await internalLinking.getInternalLinkingInstructions();

    const article = await chatgpt.generateArticle({
      topic,
      config: parentVillageBotConfig,
      includeExcerpt: true,
      internalLinkingInstructions
    });

    console.log(`\n📄 Article generated successfully\n`);

    // Generate both images using Gemini
    console.log('🖼️  Generating images with Gemini...\n');
    const images = await imageService.generateBothImages(topic);

    const wpImage = images.wordpress;
    const pinImage = images.pinterest;

    console.log(`\n📄 Generated article:\n`);
    console.log(`Title: ${article.title}`);
    if (article.excerpt) {
      console.log(`Excerpt: ${article.excerpt}`);
    }
    console.log(`\nFirst 300 characters of content:\n${article.content.substring(0, 300)}...\n`);

    console.log(`\n🖼️  Generated images (perfectly matched):\n`);
    console.log(`WordPress image: ${wpImage.localPath}`);
    console.log(`Pinterest image: ${pinImage.localPath}`);
    console.log(`\n💡 Both images are from the same source for perfect consistency!\n`);

    // Add watermark to article content
    const articleWithWatermark = article.content + `
<div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e8d4c0;">
  <p style="font-size: 16px; color: #a08c6b; font-weight: bold;">
    Made With Love By Parentvillage.blog 💛
  </p>
</div>`;

    // Generate tags for WordPress (same tags will be used for Pinterest pins)
    const pinService = new PinGenerationService(wordpressUrl);
    const ageGroup = article.content.toLowerCase().includes('toddler')
      ? 'toddler'
      : article.content.toLowerCase().includes('infant')
        ? 'infant'
        : article.content.toLowerCase().includes('preschool')
          ? 'preschool'
          : 'child';

    const articleTags = pinService.generateTags(
      { title: article.title, content: article.content, excerpt: article.excerpt || '' },
      ageGroup
    );

    console.log(`🏷️  Generated tags: ${articleTags.slice(0, 5).join(', ')}...\n`);

    // Auto-upload to WordPress as draft
    console.log('📤 Uploading to WordPress as draft...\n');

    const post = await wordpress.createPost({
      title: article.title,
      content: articleWithWatermark,
      excerpt: article.excerpt,
      tagNames: articleTags, // Add tags to WordPress post
      status: 'draft' // Saves as draft - you review and publish manually
    });

    console.log(`✅ Article uploaded to WordPress as DRAFT!\n`);
    console.log(`Post ID: ${post.id}`);

    // Upload WordPress featured image
    console.log('\n🖼️  Uploading WordPress featured image...\n');
    try {
      const fileName = path.basename(wpImage.localPath);
      const mediaResult = await wordpress.uploadMedia(wpImage.localPath, fileName);
      await wordpress.setFeaturedImage(post.id, mediaResult.attachmentId);

      console.log('✅ Featured image uploaded successfully\n');
    } catch (error) {
      console.warn('⚠️  Warning: Could not set featured image, but article was created successfully');
      console.warn(`Error: ${error instanceof Error ? error.message : error}\n`);
    }

    // Upload Pinterest pin image to WordPress media library (for permanent URL)
    console.log('📌 Uploading Pinterest pin image to WordPress...\n');
    let pinterestImageUrl = '';
    try {
      const pinFileName = path.basename(pinImage.localPath);
      const pinMediaResult = await wordpress.uploadMedia(pinImage.localPath, pinFileName);
      pinterestImageUrl = pinMediaResult.url;

      console.log(`✅ Pinterest image uploaded to WordPress media library\n`);
      console.log(`   URL: ${pinterestImageUrl}\n`);
    } catch (error) {
      console.warn('⚠️  Warning: Could not upload Pinterest image to WordPress');
      console.warn(`   Error: ${error instanceof Error ? error.message : error}\n`);
    }

    console.log(`Review URL: ${wordpressUrl}/wp-admin/post.php?post=${post.id}&action=edit`);
    console.log(`\n💡 Next steps:`);
    console.log(`1. Review the article at the link above`);
    console.log(`2. Make any edits you want`);
    console.log(`3. Click "Publish" when ready\n`);

    // Auto-generate Pinterest pins
    console.log('\n📌 Generating Pinterest pin variations...\n');
    try {
      const storageService = new PinStorageService();

      const pinArticleData = {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt || '',
        postId: post.id,
        blogUrl: wordpressUrl,
        // Use the WordPress-hosted Pinterest image URL
        imageUrl: pinterestImageUrl,
        localImagePath: pinImage.localPath
      };

      const variations = pinService.generatePinVariations(pinArticleData);
      // Reuse the same tags generated for WordPress
      const savedPin = pinService.createSavedPin(pinArticleData, variations, articleTags);
      const pinFilepath = storageService.savePinDraft(savedPin);

      console.log(`✅ Generated ${variations.length} Pinterest pin variations!\n`);
      console.log(`📂 Pins saved to: ${pinFilepath}\n`);

      variations.forEach((variation, index) => {
        console.log(`📌 PIN ${index + 1} (${variation.angle}): ${variation.title.substring(0, 50)}...`);
      });

      console.log('\n💡 REVIEW AND UPLOAD YOUR PINS:');
      console.log(`1. Review pin details: npm run review-pins ${savedPin.id} view`);
      console.log(`2. Approve pins: npm run review-pins ${savedPin.id} approve`);
      console.log(`3. Export to CSV: npm run review-pins ${savedPin.id} export`);
      console.log(`4. Upload CSV to Pinterest bulk uploader: https://www.pinterest.com/pin/create/bulk/\n`);
    } catch (pinError) {
      console.warn('⚠️  Warning: Could not generate pins automatically');
      console.warn(`Error: ${pinError instanceof Error ? pinError.message : pinError}\n`);
      console.log(`You can generate pins manually with: npm run generate-pins "${article.title}" ${post.id}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
