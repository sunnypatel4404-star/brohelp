/**
 * Image Review Command
 * View, approve, and manage generated images before publishing
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'brohelp.db');

interface ImageRecord {
  id: number;
  filename: string;
  topic: string | null;
  local_path: string;
  wordpress_url: string | null;
  created_at: string;
  file_size: number | null;
  status: string;
}

function getDb() {
  return new Database(DB_PATH);
}

function listImages(status?: string): void {
  const db = getDb();

  let query = 'SELECT * FROM images ORDER BY created_at DESC';
  let images: ImageRecord[];

  if (status) {
    query = 'SELECT * FROM images WHERE status = ? ORDER BY created_at DESC';
    images = db.prepare(query).all(status) as ImageRecord[];
  } else {
    images = db.prepare(query).all() as ImageRecord[];
  }

  db.close();

  if (images.length === 0) {
    console.log('\n📭 No images found.\n');
    return;
  }

  console.log('\n📷 Generated Images:\n');
  console.log('─'.repeat(80));

  images.forEach((img) => {
    const statusIcon = getStatusIcon(img.status);
    const date = new Date(img.created_at).toLocaleDateString();
    console.log(`${statusIcon} [${img.id}] ${img.topic || 'No topic'}`);
    console.log(`   File: ${img.filename}`);
    console.log(`   Status: ${img.status} | Date: ${date}`);
    if (img.wordpress_url) {
      console.log(`   WordPress: ${img.wordpress_url}`);
    }
    console.log('─'.repeat(80));
  });

  // Summary
  const pending = images.filter(i => i.status === 'pending_review').length;
  const approved = images.filter(i => i.status === 'approved').length;
  const uploaded = images.filter(i => i.status === 'uploaded').length;
  const rejected = images.filter(i => i.status === 'rejected').length;

  console.log(`\n📊 Summary: ${pending} pending | ${approved} approved | ${uploaded} uploaded | ${rejected} rejected\n`);
}

function viewImage(id: number): void {
  const db = getDb();
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRecord | undefined;
  db.close();

  if (!image) {
    console.log(`\n❌ Image with ID ${id} not found.\n`);
    return;
  }

  console.log('\n📷 Image Details:\n');
  console.log(`ID: ${image.id}`);
  console.log(`Topic: ${image.topic || 'N/A'}`);
  console.log(`Filename: ${image.filename}`);
  console.log(`Status: ${image.status}`);
  console.log(`Local Path: ${image.local_path}`);
  console.log(`WordPress URL: ${image.wordpress_url || 'Not uploaded'}`);
  console.log(`Created: ${image.created_at}`);
  console.log(`\n💡 To view the image, open: ${image.local_path}\n`);
  console.log(`Commands:`);
  console.log(`  npm run review-images ${id} approve  - Approve for upload`);
  console.log(`  npm run review-images ${id} reject   - Reject and regenerate`);
  console.log(`  npm run review-images ${id} upload   - Upload to WordPress\n`);
}

function approveImage(id: number): void {
  const db = getDb();
  const result = db.prepare('UPDATE images SET status = ? WHERE id = ?').run('approved', id);
  db.close();

  if (result.changes > 0) {
    console.log(`\n✅ Image ${id} approved for upload.\n`);
  } else {
    console.log(`\n❌ Image ${id} not found.\n`);
  }
}

function rejectImage(id: number): void {
  const db = getDb();
  const result = db.prepare('UPDATE images SET status = ? WHERE id = ?').run('rejected', id);
  db.close();

  if (result.changes > 0) {
    console.log(`\n🚫 Image ${id} rejected. Consider regenerating with a different prompt.\n`);
  } else {
    console.log(`\n❌ Image ${id} not found.\n`);
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending_review': return '⏳';
    case 'approved': return '✅';
    case 'uploaded': return '☁️';
    case 'rejected': return '🚫';
    default: return '❓';
  }
}

function showHelp(): void {
  console.log(`
📷 Image Review Tool

Usage:
  npm run review-images                    List all images
  npm run review-images pending            List pending images only
  npm run review-images approved           List approved images only
  npm run review-images <id> view          View image details
  npm run review-images <id> approve       Approve image for upload
  npm run review-images <id> reject        Reject image

Statuses:
  pending_review - Awaiting human review
  approved       - Ready for upload to WordPress
  uploaded       - Already uploaded to WordPress
  rejected       - Not suitable, needs regeneration
`);
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  listImages();
} else if (args[0] === 'help' || args[0] === '--help') {
  showHelp();
} else if (args[0] === 'pending') {
  listImages('pending_review');
} else if (args[0] === 'approved') {
  listImages('approved');
} else if (args[0] === 'uploaded') {
  listImages('uploaded');
} else if (args[0] === 'rejected') {
  listImages('rejected');
} else {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    console.log(`\n❌ Invalid ID: ${args[0]}\n`);
    showHelp();
  } else {
    const action = args[1] || 'view';
    switch (action) {
      case 'view':
        viewImage(id);
        break;
      case 'approve':
        approveImage(id);
        break;
      case 'reject':
        rejectImage(id);
        break;
      default:
        console.log(`\n❌ Unknown action: ${action}\n`);
        showHelp();
    }
  }
}
