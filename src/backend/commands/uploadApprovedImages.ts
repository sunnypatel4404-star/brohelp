import dotenv from 'dotenv';
import { getDatabase } from '../database/database';
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService';
import { ImageGenerationService } from '../services/imageGenerationService';
import * as path from 'path';

dotenv.config();

interface ImageRecord {
  id: number;
  filename: string;
  local_path: string;
  status: string;
  topic: string | null;
}

async function main() {
  const wordpressUrl = process.env.WORDPRESS_URL;
  const wordpressUsername = process.env.WORDPRESS_USERNAME;
  const wordpressPassword = process.env.WORDPRESS_PASSWORD;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!wordpressUrl || !wordpressUsername || !wordpressPassword) {
    console.error('❌ Missing WordPress configuration in .env file');
    process.exit(1);
  }

  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env file');
    process.exit(1);
  }

  const postId = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;

  if (!postId) {
    console.error('❌ Please provide a WordPress post ID');
    console.error('Usage: npm run upload-approved <post_id>');
    console.error('Example: npm run upload-approved 123');
    process.exit(1);
  }

  try {
    console.log(`\n🚀 Uploading approved images to WordPress post ${postId}...\n`);

    const db = getDatabase();
    const wordpress = new WordPressXmlRpcService(wordpressUrl, wordpressUsername, wordpressPassword);
    const imageService = new ImageGenerationService(openaiApiKey);

    // Get approved WordPress images (not yet uploaded)
    const approvedImages = db.prepare(`
      SELECT * FROM images
      WHERE status = 'approved'
      AND wordpress_url IS NULL
      AND filename LIKE 'wp_%'
      ORDER BY created_at DESC
      LIMIT 5
    `).all() as ImageRecord[];

    if (approvedImages.length === 0) {
      console.log('📭 No approved WordPress images found that need uploading.');
      console.log('\nTo approve images:');
      console.log('1. npm run review-images           - List all images');
      console.log('2. npm run review-images <id> approve  - Approve an image\n');
      process.exit(0);
    }

    console.log(`Found ${approvedImages.length} approved image(s):\n`);
    approvedImages.forEach((img, i) => {
      console.log(`${i + 1}. [${img.id}] ${img.topic || 'No topic'} - ${img.filename}`);
    });

    // Use the most recent approved image
    const selectedImage = approvedImages[0];
    console.log(`\n📤 Uploading: ${selectedImage.filename}`);
    console.log(`   Topic: ${selectedImage.topic}`);
    console.log(`   Path: ${selectedImage.local_path}\n`);

    // Upload as featured image
    const fileName = path.basename(selectedImage.local_path);
    const mediaResult = await wordpress.uploadMedia(selectedImage.local_path, fileName);
    await wordpress.setFeaturedImage(postId, mediaResult.attachmentId);

    // Update database
    imageService.updateWordPressUrl(selectedImage.local_path, mediaResult.url);
    db.prepare('UPDATE images SET status = ? WHERE id = ?').run('uploaded', selectedImage.id);

    console.log(`✅ Image uploaded successfully!`);
    console.log(`   WordPress URL: ${mediaResult.url}`);
    console.log(`   Attachment ID: ${mediaResult.attachmentId}\n`);
    console.log(`🔗 View post: ${wordpressUrl}/wp-admin/post.php?post=${postId}&action=edit\n`);

  } catch (error) {
    console.error('❌ Error uploading image:', error);
    process.exit(1);
  }
}

main();
