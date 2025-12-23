#!/usr/bin/env ts-node
/**
 * Generate Affiliate Article Command
 *
 * Usage:
 *   npm run generate-affiliate "Best Sensory Toys for Toddlers"
 *   npm run generate-affiliate --random
 *   npm run generate-affiliate --list
 *
 * The article will be generated with product placeholders if Amazon PA API
 * is not available. You can then add real product links before publishing.
 */

import 'dotenv/config';
import { AffiliateArticleService } from '../services/affiliateArticleService';
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService';
import { ImageGenerationService } from '../services/imageGenerationService';
import { InternalLinkingService } from '../services/internalLinkingService';

async function main() {
  const args = process.argv.slice(2);

  // Show topic suggestions
  if (args.includes('--list') || args.includes('-l')) {
    console.log('\n📝 Affiliate Article Topic Suggestions:\n');
    const topics = AffiliateArticleService.getTopicSuggestions();
    topics.forEach((topic, i) => {
      console.log(`  ${i + 1}. ${topic}`);
    });
    console.log('\nUsage: npm run generate-affiliate "Topic Name"');
    return;
  }

  // Random topic
  let topic: string;
  if (args.includes('--random') || args.includes('-r')) {
    const topics = AffiliateArticleService.getTopicSuggestions();
    topic = topics[Math.floor(Math.random() * topics.length)];
    console.log(`\n🎲 Random topic selected: "${topic}"`);
  } else if (args.length > 0 && !args[0].startsWith('-')) {
    topic = args.join(' ');
  } else {
    console.log('\n❌ Please provide a topic or use --random');
    console.log('   npm run generate-affiliate "Best Sensory Toys for Toddlers"');
    console.log('   npm run generate-affiliate --random');
    console.log('   npm run generate-affiliate --list');
    return;
  }

  console.log('\n🚀 Starting affiliate article generation...\n');
  console.log(`📝 Topic: ${topic}`);

  try {
    // Initialize services
    const affiliateService = new AffiliateArticleService();
    const wordpressService = new WordPressXmlRpcService(
      process.env.WORDPRESS_URL || '',
      process.env.WORDPRESS_USERNAME || '',
      process.env.WORDPRESS_PASSWORD || ''
    );
    const imageService = new ImageGenerationService(
      process.env.OPENAI_API_KEY || '',
      './generated_images',
      'gemini'
    );
    const internalLinking = new InternalLinkingService(wordpressService);

    // Generate article
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 1: Generating article content');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Fetch existing articles for internal linking
    const internalLinkingInstructions = await internalLinking.getInternalLinkingInstructions();

    const article = await affiliateService.generateArticle({
      topic,
      productCount: 5,
      internalLinkingInstructions
    });

    console.log(`✅ Article generated: "${article.title}"`);

    if (article.isPlaceholder) {
      console.log('\n⚠️  PLACEHOLDER PRODUCTS - Manual entry required');
      console.log('   Amazon PA API requires 10 sales/30 days for access');
      console.log('   Products in article need to be replaced with real links\n');
    }

    // Generate featured image
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 2: Generating featured image');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const image = await imageService.generateArticleImage({
      topic: topic,
      imageType: 'wordpress'
    });

    console.log(`✅ Image generated: ${image.localPath}`);

    // Upload to WordPress as draft
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 3: Uploading to WordPress (as draft)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Upload image first
    const imageName = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-') + '.png';
    const mediaResult = await wordpressService.uploadMedia(image.localPath, imageName);
    console.log(`   📷 Image uploaded: ID ${mediaResult.attachmentId}`);

    // Create draft post
    const postResult = await wordpressService.createPost({
      title: article.title,
      content: article.content,
      status: 'draft',  // Always draft for affiliate articles (needs review)
      tagNames: ['affiliate', 'product roundup', 'parenting products'],
      excerpt: article.excerpt
    });

    const postId = postResult.id;
    console.log(`✅ Draft created: Post ID ${postId}`);

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ AFFILIATE ARTICLE GENERATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`📝 Title: ${article.title}`);
    console.log(`🖼️  Image: ${image.localPath}`);
    console.log(`📄 WordPress Draft ID: ${postId}`);
    console.log(`🔗 Edit URL: ${process.env.WORDPRESS_URL}wp-admin/post.php?post=${postId}&action=edit`);

    if (article.isPlaceholder) {
      console.log('\n⚠️  NEXT STEPS:');
      console.log('   1. Go to WordPress and edit the draft');
      console.log('   2. Replace placeholder products with real Amazon products');
      console.log('   3. Update affiliate links with real ASINs');
      console.log('   4. Review and publish when ready');
      console.log(`\n   Use this format for links: https://www.amazon.com/dp/[ASIN]?tag=${process.env.AMAZON_PARTNER_TAG}`);
    } else {
      console.log('\n📌 NEXT STEPS:');
      console.log('   1. Review the draft in WordPress');
      console.log('   2. Make any needed edits');
      console.log('   3. Publish when ready');
    }

    // Products summary
    console.log('\n📦 PRODUCTS IN ARTICLE:');
    article.products.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name}`);
      if (p.asin && !p.asin.includes('[')) {
        console.log(`      ASIN: ${p.asin}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Error generating affiliate article:', error);
    process.exit(1);
  }
}

main();
