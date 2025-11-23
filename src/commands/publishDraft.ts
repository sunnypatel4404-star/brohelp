import dotenv from 'dotenv';
import { WordPressService } from '../services/wordpressService';

dotenv.config();

async function main() {
  const wordpressUrl = process.env.WORDPRESS_URL;
  const wordpressUsername = process.env.WORDPRESS_USERNAME;
  const wordpressPassword = process.env.WORDPRESS_PASSWORD;

  // Validate environment variables
  if (!wordpressUrl || !wordpressUsername || !wordpressPassword) {
    console.error('❌ Missing WordPress configuration in .env file');
    process.exit(1);
  }

  const postId = parseInt(process.argv[2], 10);

  if (!postId || isNaN(postId)) {
    console.error('❌ Please provide a post ID');
    console.error('Usage: npm run publish-draft <post-id>');
    console.error('Example: npm run publish-draft 123');
    process.exit(1);
  }

  try {
    console.log(`🚀 Publishing draft #${postId}...\n`);

    const wordpress = new WordPressService(wordpressUrl, wordpressUsername, wordpressPassword);

    // Get the current post to verify it exists
    const post = await wordpress.getPost(postId);
    console.log(`📄 Post: "${post.title.rendered}"`);
    console.log(`Status: ${post.status}\n`);

    if (post.status === 'publish') {
      console.log('⚠️  This post is already published!');
      process.exit(0);
    }

    // Publish the post
    await wordpress.updatePost(postId, { status: 'publish' });

    console.log(`\n✅ Article published successfully!\n`);
    console.log(`View on site: ${post.link}`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
