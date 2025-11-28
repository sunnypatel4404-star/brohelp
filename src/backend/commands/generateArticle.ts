import dotenv from 'dotenv';
import * as path from 'path';
import { ChatGPTService } from '../services/chatgptService';
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService';
import { ImageGenerationService } from '../services/imageGenerationService';
import { PinGenerationService } from '../services/pinGenerationService';
import { PinStorageService } from '../services/pinStorageService';
import { parentVillageBotConfig } from '../config/botConfig';

dotenv.config();

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

  try {
    console.log('🚀 Starting article + image generation...\n');

    // Initialize services with bot configuration
    const chatgpt = new ChatGPTService(openaiApiKey, parentVillageBotConfig);
    const wordpress = new WordPressXmlRpcService(wordpressUrl, wordpressUsername, wordpressPassword);
    const imageService = new ImageGenerationService(openaiApiKey);

    // Generate an article
    const topic = process.argv[2] || 'Building independence in toddlers through daily routines';
    console.log(`📝 Generating article about: "${topic}"\n`);
    console.log(`Configuration: ${parentVillageBotConfig.publishingFrequency} publishing, ${parentVillageBotConfig.wordCountMin}-${parentVillageBotConfig.wordCountMax} words\n`);

    const article = await chatgpt.generateArticle({
      topic,
      config: parentVillageBotConfig,
      includeExcerpt: true
    });

    console.log(`\n📄 Article generated successfully\n`);

    // Generate on-brand illustration
    console.log('🎨 Generating on-brand illustration...\n');
    const image = await imageService.generateArticleImage({
      topic,
      articleTitle: article.title,
      articleContent: article.content
    });

    console.log(`📄 Generated article:\n`);
    console.log(`Title: ${article.title}`);
    if (article.excerpt) {
      console.log(`Excerpt: ${article.excerpt}`);
    }
    console.log(`\nFirst 300 characters of content:\n${article.content.substring(0, 300)}...\n`);

    console.log(`\n🖼️  Generated image:\n`);
    console.log(`Image path: ${image.localPath}`);
    console.log(`\n💡 Review the image to ensure it matches your brand\n`);

    // Add watermark to article content
    const articleWithWatermark = article.content + `
<div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e8d4c0;">
  <p style="font-size: 16px; color: #a08c6b; font-weight: bold;">
    Made With Love By Parentvillage.blog 💛
  </p>
</div>`;

    // Auto-upload to WordPress as draft
    console.log('📤 Uploading to WordPress as draft...\n');

    const post = await wordpress.createPost({
      title: article.title,
      content: articleWithWatermark,
      excerpt: article.excerpt,
      status: 'draft' // Saves as draft - you review and publish manually
    });

    console.log(`✅ Article uploaded to WordPress as DRAFT!\n`);
    console.log(`Post ID: ${post.id}`);

    // Upload and set featured image
    console.log('\n🖼️  Uploading featured image...\n');
    try {
      const fileName = path.basename(image.localPath);
      const attachmentId = await wordpress.uploadMedia(image.localPath, fileName);
      await wordpress.setFeaturedImage(post.id, attachmentId);
    } catch (error) {
      console.warn('⚠️  Warning: Could not set featured image, but article was created successfully');
      console.warn(`Error: ${error instanceof Error ? error.message : error}\n`);
    }

    console.log(`Review URL: ${wordpressUrl}/wp-admin/post.php?post=${post.id}&action=edit`);
    console.log(`\n💡 Next steps:`);
    console.log(`1. Review the article at the link above`);
    console.log(`2. Make any edits you want`);
    console.log(`3. Click "Publish" when ready\n`);

    // Auto-generate Pinterest pins
    console.log('\n📌 Generating Pinterest pin variations...\n');
    try {
      const pinService = new PinGenerationService(wordpressUrl);
      const storageService = new PinStorageService();

      const pinArticleData = {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt || '',
        postId: post.id,
        blogUrl: wordpressUrl,
        imageUrl: image.url
      };

      const variations = pinService.generatePinVariations(pinArticleData);
      const ageGroup = article.content.toLowerCase().includes('toddler')
        ? 'toddler'
        : article.content.toLowerCase().includes('infant')
          ? 'infant'
          : article.content.toLowerCase().includes('preschool')
            ? 'preschool'
            : 'child';

      const tags = pinService.generateTags(pinArticleData, ageGroup);
      const savedPin = pinService.createSavedPin(pinArticleData, variations, tags);
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
