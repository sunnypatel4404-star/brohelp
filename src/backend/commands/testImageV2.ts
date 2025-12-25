#!/usr/bin/env ts-node
/**
 * Test the new ImageServiceV2
 */

import 'dotenv/config';
import { ImageServiceV2 } from '../services/imageServiceV2';

async function main() {
  const topic = process.argv[2] || 'Best sensory toys for toddlers';

  console.log('🧪 Testing ImageServiceV2\n');
  console.log(`Topic: "${topic}"\n`);

  const imageService = new ImageServiceV2('./generated_images');

  try {
    // Test single image generation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 1: Generate WordPress image');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const wpImage = await imageService.generateImage({
      topic,
      type: 'wordpress'
    });

    console.log(`✅ WordPress image: ${wpImage.localPath}`);
    console.log(`   Dimensions: ${wpImage.width}x${wpImage.height}\n`);

    // Test both images generation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 2: Generate both WordPress + Pinterest');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const bothImages = await imageService.generateBothImages(topic + ' guide');

    console.log(`✅ WordPress: ${bothImages.wordpress.localPath}`);
    console.log(`✅ Pinterest: ${bothImages.pinterest.localPath}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
