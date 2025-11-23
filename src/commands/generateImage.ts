import dotenv from 'dotenv';
import { ImageGenerationService } from '../services/imageGenerationService';

dotenv.config();

async function main() {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env file');
    process.exit(1);
  }

  const topic = process.argv[2];
  const articleTitle = process.argv[3];

  if (!topic) {
    console.error('❌ Please provide an article topic');
    console.error('Usage: npm run generate-image "Article Topic" [optional: "Article Title"]');
    console.error('Example: npm run generate-image "Toddler sleep routines" "How to Build Better Sleep Habits"');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting image generation...\n');

    const imageService = new ImageGenerationService(openaiApiKey);

    console.log(`📝 Topic: ${topic}`);
    if (articleTitle) {
      console.log(`📄 Title: ${articleTitle}\n`);
    }

    const image = await imageService.generateArticleImage({
      topic,
      articleTitle
    });

    console.log(`\n✅ Image generation complete!\n`);
    console.log(`Local path: ${image.localPath}`);
    console.log(`\n📌 Next steps:`);
    console.log(`1. Review the image at: ${image.localPath}`);
    console.log(`2. Upload to WordPress as featured image`);
    console.log(`3. Use in article generation\n`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
