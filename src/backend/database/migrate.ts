/**
 * Migration script to migrate existing JSON files to SQLite database
 * Run with: npx ts-node src/backend/database/migrate.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from './database';
import { SavedPin, PinMetadata } from '../config/pinConfig';

const PINS_DIR = './saved_pins';
const IMAGES_DIR = './generated_images';

interface MigrationStats {
  pins: { total: number; migrated: number; failed: number };
  images: { total: number; migrated: number; failed: number };
}

function migratePins(stats: MigrationStats): void {
  console.log('\n📌 Migrating pins from JSON files...\n');

  if (!fs.existsSync(PINS_DIR)) {
    console.log('   No saved_pins directory found. Skipping pin migration.');
    return;
  }

  const files = fs.readdirSync(PINS_DIR).filter(f => f.endsWith('.json'));
  stats.pins.total = files.length;

  if (files.length === 0) {
    console.log('   No JSON files found in saved_pins/');
    return;
  }

  const db = getDatabase();

  for (const file of files) {
    try {
      const filePath = path.join(PINS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const pin: SavedPin = JSON.parse(content);

      // Check if pin already exists
      const existing = db.prepare('SELECT id FROM pins WHERE id = ?').get(pin.id);
      if (existing) {
        console.log(`   ⏭️  Skipping ${pin.id} (already exists)`);
        stats.pins.migrated++;
        continue;
      }

      // Insert pin
      db.prepare(`
        INSERT INTO pins (id, article_title, article_id, post_id, suggested_tags, created_at, status, approved_at, published_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        pin.id,
        pin.articleTitle,
        pin.articleId ?? null,
        pin.postId ?? null,
        JSON.stringify(pin.suggestedTags || []),
        pin.createdAt,
        pin.status,
        pin.approvedAt ?? null,
        pin.publishedAt ?? null,
        pin.notes ?? null
      );

      // Insert variations
      const insertVariation = db.prepare(`
        INSERT INTO pin_variations (pin_id, title, description, link, image_url, alt_text, board_name, dominant_color, angle, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      pin.variations.forEach((v: PinMetadata, i: number) => {
        insertVariation.run(
          pin.id,
          v.title,
          v.description,
          v.link,
          v.imageUrl ?? null,
          v.altText ?? null,
          v.boardName ?? null,
          v.dominantColor ?? null,
          v.angle,
          i
        );
      });

      console.log(`   ✅ Migrated: ${pin.id} (${pin.variations.length} variations)`);
      stats.pins.migrated++;
    } catch (error) {
      console.error(`   ❌ Failed to migrate ${file}:`, error instanceof Error ? error.message : error);
      stats.pins.failed++;
    }
  }
}

function migrateImages(stats: MigrationStats): void {
  console.log('\n🖼️  Migrating image metadata...\n');

  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('   No generated_images directory found. Skipping image migration.');
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.png'));
  stats.images.total = files.length;

  if (files.length === 0) {
    console.log('   No PNG files found in generated_images/');
    return;
  }

  const db = getDatabase();

  for (const filename of files) {
    try {
      // Check if image already exists
      const existing = db.prepare('SELECT id FROM images WHERE filename = ?').get(filename);
      if (existing) {
        console.log(`   ⏭️  Skipping ${filename} (already exists)`);
        stats.images.migrated++;
        continue;
      }

      const localPath = path.join(IMAGES_DIR, filename);
      const fileStats = fs.statSync(localPath);

      // Extract topic and timestamp from filename
      // Format: topic_timestamp.png (e.g., crawling_1764365870073.png)
      const match = filename.match(/^(.+)_(\d+)\.png$/);
      let topic = filename.replace('.png', '');
      let createdAt = new Date().toISOString();

      if (match) {
        topic = match[1].replace(/-/g, ' ');
        const timestamp = parseInt(match[2], 10);
        createdAt = new Date(timestamp).toISOString();
      }

      db.prepare(`
        INSERT INTO images (filename, topic, local_path, created_at, file_size)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        filename,
        topic,
        localPath,
        createdAt,
        fileStats.size
      );

      console.log(`   ✅ Migrated: ${filename}`);
      stats.images.migrated++;
    } catch (error) {
      console.error(`   ❌ Failed to migrate ${filename}:`, error instanceof Error ? error.message : error);
      stats.images.failed++;
    }
  }
}

function printSummary(stats: MigrationStats): void {
  console.log('\n' + '═'.repeat(50));
  console.log('📊 MIGRATION SUMMARY');
  console.log('═'.repeat(50));
  console.log(`\n📌 Pins:`);
  console.log(`   Total files:  ${stats.pins.total}`);
  console.log(`   Migrated:     ${stats.pins.migrated}`);
  console.log(`   Failed:       ${stats.pins.failed}`);
  console.log(`\n🖼️  Images:`);
  console.log(`   Total files:  ${stats.images.total}`);
  console.log(`   Migrated:     ${stats.images.migrated}`);
  console.log(`   Failed:       ${stats.images.failed}`);
  console.log('\n' + '═'.repeat(50));

  if (stats.pins.failed === 0 && stats.images.failed === 0) {
    console.log('✅ Migration completed successfully!\n');
    console.log('You can now safely rename the old directories:');
    console.log('   mv saved_pins saved_pins_backup');
    console.log('   (Keep generated_images as images are still served from filesystem)\n');
  } else {
    console.log('⚠️  Migration completed with some failures.');
    console.log('   Review the errors above and fix any issues.\n');
  }
}

function main(): void {
  console.log('\n' + '═'.repeat(50));
  console.log('🗄️  SQLite Migration Tool');
  console.log('═'.repeat(50));
  console.log('\nMigrating existing JSON data to SQLite database...');

  const stats: MigrationStats = {
    pins: { total: 0, migrated: 0, failed: 0 },
    images: { total: 0, migrated: 0, failed: 0 }
  };

  try {
    // Initialize database (creates tables if they don't exist)
    getDatabase();
    console.log('✅ Database initialized at ./data/brohelp.db');

    migratePins(stats);
    migrateImages(stats);
    printSummary(stats);
  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run migration
main();
