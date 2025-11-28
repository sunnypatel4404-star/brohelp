import dotenv from 'dotenv';
import { PinGenerationService } from '../services/pinGenerationService';
import { PinStorageService } from '../services/pinStorageService';

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

    // Simulated article data (in real scenario, this would come from WordPress)
    const articleData = {
      title: topic,
      content: `Article about ${topic}. This would contain the full article content that was generated with ChatGPT.`,
      excerpt: `Learn practical tips about ${topic} for parents and caregivers.`,
      postId: postId,
      blogUrl: process.env.WORDPRESS_URL || 'https://parentvillage.blog',
      imageUrl: undefined // Would be populated from featured image
    };

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
