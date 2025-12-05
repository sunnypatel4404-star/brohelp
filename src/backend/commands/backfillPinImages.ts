import dotenv from 'dotenv';
import { getDatabase } from '../database/database';

dotenv.config();

interface PinRow {
  id: string;
  article_title: string;
}

interface VariationRow {
  id: number;
  pin_id: string;
  image_url: string | null;
}

interface ImageRow {
  filename: string;
  wordpress_url: string;
}

/**
 * Backfill WordPress URLs for existing pins
 *
 * This script:
 * 1. Finds all pins that don't have valid WordPress image URLs
 * 2. Tries to match them with images in the images table
 * 3. Updates the pin_variations with the WordPress URLs
 */
async function main() {
  console.log('🔄 Starting Pinterest image URL backfill...\n');

  const db = getDatabase();

  // Get all pins
  const pins = db.prepare('SELECT id, article_title FROM pins').all() as PinRow[];
  console.log(`📌 Found ${pins.length} pins to process\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const pin of pins) {
    // Get variations for this pin
    const variations = db.prepare(
      'SELECT id, pin_id, image_url FROM pin_variations WHERE pin_id = ?'
    ).all(pin.id) as VariationRow[];

    // Check if variations already have valid WordPress URLs
    const hasValidUrl = variations.some(v =>
      v.image_url && v.image_url.includes('parentvillageblog.files.wordpress.com')
    );

    if (hasValidUrl) {
      console.log(`✓ ${pin.article_title.substring(0, 50)}... - already has WordPress URL`);
      skipped++;
      continue;
    }

    // Try to find matching image in images table
    // Clean the article title for matching
    const cleanTitle = pin.article_title
      .replace(/[^\w\s-]/g, '')  // Remove emoji and special chars
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 4)
      .join('-');

    // Try multiple search patterns
    const searchPatterns = [
      `pin_${cleanTitle.substring(0, 25)}%`,
      `pin_%${cleanTitle.split('-').slice(0, 2).join('-')}%`,
      `pin_%${cleanTitle.split('-')[0]}%${cleanTitle.split('-')[1] || ''}%`
    ];

    let foundImage: ImageRow | undefined;

    for (const pattern of searchPatterns) {
      const imageRow = db.prepare(`
        SELECT filename, wordpress_url FROM images
        WHERE filename LIKE ?
        AND wordpress_url LIKE 'http%'
        ORDER BY created_at DESC
        LIMIT 1
      `).get(pattern) as ImageRow | undefined;

      if (imageRow?.wordpress_url) {
        foundImage = imageRow;
        break;
      }
    }

    if (foundImage) {
      // Update all variations for this pin with the WordPress URL
      const result = db.prepare(
        'UPDATE pin_variations SET image_url = ? WHERE pin_id = ?'
      ).run(foundImage.wordpress_url, pin.id);

      console.log(`✅ ${pin.article_title.substring(0, 50)}...`);
      console.log(`   Updated ${result.changes} variations with: ${foundImage.wordpress_url.substring(0, 60)}...`);
      updated++;
    } else {
      console.log(`❌ ${pin.article_title.substring(0, 50)}... - no matching image found`);
      console.log(`   Searched for patterns like: ${searchPatterns[0]}`);
      notFound++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL SUMMARY:');
  console.log(`   ✅ Updated: ${updated} pins`);
  console.log(`   ⏭️  Skipped (already had URLs): ${skipped} pins`);
  console.log(`   ❌ Not found: ${notFound} pins`);
  console.log('='.repeat(60) + '\n');

  if (notFound > 0) {
    console.log('💡 Tips for pins without matching images:');
    console.log('   1. Regenerate the article to create new pins with images');
    console.log('   2. Manually upload images to WordPress and update the database');
    console.log('   3. Delete old pins that are no longer needed\n');
  }
}

main().catch(err => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
