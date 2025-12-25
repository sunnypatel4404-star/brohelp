import dotenv from 'dotenv';
import { ImageServiceV2 } from '../services/imageServiceV2';

dotenv.config();

async function main() {
  const topic = process.argv[2];

  if (!topic) {
    console.error('❌ Please provide an article topic');
    console.error('Usage: npm run generate-image "Article Topic"');
    console.error('Example: npm run generate-image "Toddler sleep routines"');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting image generation...\n');

    const imageService = new ImageServiceV2('./generated_images');

    console.log(`📝 Topic: ${topic}\n`);

    const images = await imageService.generateBothImages(topic);

    console.log(`\n✅ Image generation complete!\n`);
    console.log(`WordPress image: ${images.wordpress.localPath}`);
    console.log(`Pinterest image: ${images.pinterest.localPath}`);
    console.log(`\n📌 Next steps:`);
    console.log(`1. Review the images in the generated_images folder`);
    console.log(`2. Use with article generation\n`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
