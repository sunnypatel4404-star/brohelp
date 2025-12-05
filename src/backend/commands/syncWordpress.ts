import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService';

dotenv.config();

const SYNCED_POSTS_DIR = path.join(process.cwd(), 'synced_posts');

async function main() {
  const wordpressUrl = process.env.WORDPRESS_URL;
  const wordpressUsername = process.env.WORDPRESS_USERNAME;
  const wordpressPassword = process.env.WORDPRESS_PASSWORD;

  if (!wordpressUrl || !wordpressUsername || !wordpressPassword) {
    console.error('❌ Missing WordPress configuration in .env file');
    process.exit(1);
  }

  console.log('🔄 Syncing posts from WordPress...\n');

  const wordpress = new WordPressXmlRpcService(wordpressUrl, wordpressUsername, wordpressPassword);

  // Ensure synced_posts directory exists
  if (!fs.existsSync(SYNCED_POSTS_DIR)) {
    fs.mkdirSync(SYNCED_POSTS_DIR, { recursive: true });
  }

  try {
    // Fetch all posts (both published and drafts)
    const publishedPosts = await wordpress.getPosts({ number: 100, status: 'publish' });
    const draftPosts = await wordpress.getPosts({ number: 100, status: 'draft' });

    const allPosts = [...publishedPosts, ...draftPosts];

    console.log(`📥 Found ${allPosts.length} posts (${publishedPosts.length} published, ${draftPosts.length} drafts)\n`);

    // Save each post as a JSON file
    for (const post of allPosts) {
      const filename = `${post.id}-${sanitizeFilename(post.slug || post.title)}.json`;
      const filepath = path.join(SYNCED_POSTS_DIR, filename);

      fs.writeFileSync(filepath, JSON.stringify(post, null, 2));
      console.log(`  ✓ ${post.title} (${post.status})`);
    }

    // Save an index file
    const index = {
      syncedAt: new Date().toISOString(),
      totalPosts: allPosts.length,
      published: publishedPosts.length,
      drafts: draftPosts.length,
      posts: allPosts.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        slug: p.slug,
        date: p.date
      }))
    };

    fs.writeFileSync(
      path.join(SYNCED_POSTS_DIR, '_index.json'),
      JSON.stringify(index, null, 2)
    );

    console.log(`\n✅ Sync complete! Posts saved to synced_posts/`);
    console.log(`   Index file: synced_posts/_index.json`);

  } catch (error) {
    console.error('❌ Error syncing posts:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

main();
