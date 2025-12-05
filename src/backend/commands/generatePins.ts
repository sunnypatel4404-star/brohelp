import dotenv from 'dotenv';
import { PinGenerationService } from '../services/pinGenerationService';
import { PinStorageService } from '../services/pinStorageService';
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService';

dotenv.config();

async function main() {
  const topic = process.argv[2];
  const postId = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  if (!topic) {
    console.error('❌ Please provide an article topic');
    console.error(
      'Usage: npm run generate-pins "Article Topic" [optional: post_id]'
    );
    console.error('Example: npm run generate-pins "Toddler sleep routines" 522');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting Pinterest pin generation...\n');

    const pinService = new PinGenerationService();
    const storageService = new PinStorageService();

    let articleData;

    // If post ID is provided, fetch the actual article from WordPress
    if (postId) {
      console.log(`📥 Fetching article from WordPress (Post ID: ${postId})...\n`);

      const wordpressUrl = process.env.WORDPRESS_URL;
      const wordpressUsername = process.env.WORDPRESS_USERNAME;
      const wordpressPassword = process.env.WORDPRESS_PASSWORD;

      if (!wordpressUrl || !wordpressUsername || !wordpressPassword) {
        console.error('❌ Missing WordPress credentials in .env');
        console.error('Using simulated data instead...\n');

        articleData = {
          title: topic,
          content: `This is simulated content for "${topic}". For better pin quality, please configure WordPress credentials to fetch actual article content.`,
          excerpt: `Learn practical tips about ${topic} for parents and caregivers.`,
          postId: postId,
          blogUrl: process.env.WORDPRESS_URL || 'https://parentvillage.blog',
          imageUrl: undefined
        };
      } else {
        const wordpress = new WordPressXmlRpcService(wordpressUrl, wordpressUsername, wordpressPassword);

        try {
          const postResponse = await wordpress.getPost(postId);
          const post = postResponse as { title: string; content: string; excerpt?: string };

          articleData = {
            title: post.title,
            content: post.content,
            excerpt: post.excerpt || post.content.substring(0, 300),
            postId: postId,
            blogUrl: wordpressUrl,
            imageUrl: undefined // Could fetch featured image URL here
          };

          console.log(`✓ Fetched article: "${post.title}"\n`);
        } catch (error) {
          console.error('⚠️  Could not fetch article from WordPress');
          console.error(`Error: ${error instanceof Error ? error.message : error}`);
          console.error('Using simulated data instead...\n');

          articleData = {
            title: topic,
            content: `This is simulated content for "${topic}". Could not fetch actual article from WordPress.`,
            excerpt: `Learn practical tips about ${topic} for parents and caregivers.`,
            postId: postId,
            blogUrl: process.env.WORDPRESS_URL || 'https://parentvillage.blog',
            imageUrl: undefined
          };
        }
      }
    } else {
      // No post ID - use simulated data
      articleData = {
        title: topic,
        content: `This is a comprehensive guide about ${topic} for parents and caregivers. The article covers practical strategies, expert tips, and real-world solutions to help families navigate this important aspect of parenting.`,
        excerpt: `Discover practical tips and expert advice about ${topic}. Learn strategies that work for real families.`,
        postId: postId,
        blogUrl: process.env.WORDPRESS_URL || 'https://parentvillage.blog',
        imageUrl: undefined
      };
    }

    console.log(`📝 Topic: ${topic}`);
    if (postId) {
      console.log(`📄 Post ID: ${postId}\n`);
    }

    // Generate pin variations
    console.log('📌 Generating pin variations...\n');
    const variations = pinService.generatePinVariations(articleData);

    console.log(`✓ Generated ${variations.length} pin variations\n`);

    // Detect age group
    const ageGroup = articleData.content.toLowerCase().includes('toddler')
      ? 'toddler'
      : articleData.content.toLowerCase().includes('infant')
        ? 'infant'
        : articleData.content.toLowerCase().includes('preschool')
          ? 'preschool'
          : 'child';

    // Generate suggested tags
    console.log('🏷️  Generating suggested tags...\n');
    const tags = pinService.generateTags(articleData, ageGroup);

    console.log(`✓ Generated ${tags.length} suggested tags\n`);

    // Create and save pin draft
    const savedPin = pinService.createSavedPin(articleData, variations, tags);
    const filepath = storageService.savePinDraft(savedPin);

    // Display pin information
    console.log(`✅ Pin drafts created and saved!\n`);
    console.log(`📍 Pin ID: ${savedPin.id}`);
    console.log(`📂 Saved to: ${filepath}\n`);

    console.log('═══════════════════════════════════════════════════════\n');

    // Display each variation
    variations.forEach((variation, index) => {
      console.log(`📌 PIN VARIATION ${index + 1}: ${variation.angle}`);
      console.log(`Title: ${variation.title}`);
      console.log(`Description: ${variation.description}`);
      console.log(`Link: ${variation.link}`);
      console.log(`Board: ${variation.boardName}`);
      console.log('---');
    });

    console.log('\n═══════════════════════════════════════════════════════\n');

    console.log('🏷️  SUGGESTED TAGS (copy/paste into Pinterest):\n');
    console.log(tags.join(' '));

    console.log('\n═══════════════════════════════════════════════════════\n');

    console.log('💡 NEXT STEPS:');
    console.log(`1. Review the pin variations above`);
    console.log(`2. Copy the suggested tags to Pinterest`);
    console.log(`3. Approve pins: npm run approve-pins ${savedPin.id}`);
    console.log(`4. Upload to Pinterest: npm run upload-pins ${savedPin.id}\n`);

    console.log(`📊 PIN STATISTICS:`);
    const stats = storageService.getStats();
    console.log(`  Total pins: ${stats.total}`);
    console.log(`  Drafts: ${stats.draft}`);
    console.log(`  Approved: ${stats.approved}`);
    console.log(`  Published: ${stats.published}\n`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
