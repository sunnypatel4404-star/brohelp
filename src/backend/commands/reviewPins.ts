import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { PinStorageService } from '../services/pinStorageService';

dotenv.config();

async function main() {
  const firstArg = process.argv[2];
  const secondArg = process.argv[3];

  const storageService = new PinStorageService();

  // Check if user wants to list all pins
  if (!firstArg || firstArg === 'list' || firstArg === '--list' || firstArg === '-l') {
    console.log('📌 All Saved Pins:\n');
    const allPins = storageService.listPinDrafts();

    if (allPins.length === 0) {
      console.log('No pins saved yet. Generate some with: npm run generate-article "topic"\n');
      process.exit(0);
    }

    const byStatus = {
      draft: allPins.filter(p => p.status === 'draft'),
      approved: allPins.filter(p => p.status === 'approved'),
      published: allPins.filter(p => p.status === 'published')
    };

    console.log(`📋 DRAFT PINS (${byStatus.draft.length}):`);
    byStatus.draft.forEach((pin, i) => {
      console.log(`  ${i + 1}. ${pin.id}`);
      console.log(`     Article: ${pin.articleTitle}`);
      console.log(`     Variations: ${pin.variations.length}`);
    });

    console.log(`\n✅ APPROVED PINS (${byStatus.approved.length}):`);
    byStatus.approved.forEach((pin, i) => {
      console.log(`  ${i + 1}. ${pin.id}`);
      console.log(`     Article: ${pin.articleTitle}`);
    });

    console.log(`\n📤 PUBLISHED PINS (${byStatus.published.length}):`);
    byStatus.published.forEach((pin, i) => {
      console.log(`  ${i + 1}. ${pin.id}`);
      console.log(`     Article: ${pin.articleTitle}`);
    });

    console.log('\nView details: npm run review-pins <pin_id> view');
    console.log('Approve pins: npm run review-pins <pin_id> approve');
    console.log('Export to CSV: npm run review-pins <pin_id> export\n');
    process.exit(0);
  }

  // If we get here, first arg is a pin ID
  const pinId = firstArg;
  const action = secondArg || 'view';

  try {
    const pin = storageService.loadPinDraft(pinId);

    if (!pin) {
      console.error(`❌ Pin not found: ${pinId}`);
      console.error('\nAvailable pins:');
      console.error('npm run review-pins list\n');
      process.exit(1);
    }

    if (action === 'view') {
      console.log(`\n📌 PIN DETAILS: ${pin.id}\n`);
      console.log(`Article: ${pin.articleTitle}`);
      console.log(`Article ID: ${pin.articleId || 'N/A'}`);
      console.log(`Status: ${pin.status}`);
      console.log(`Created: ${new Date(pin.createdAt).toLocaleString()}`);

      if (pin.approvedAt) {
        console.log(`Approved: ${new Date(pin.approvedAt).toLocaleString()}`);
      }
      if (pin.publishedAt) {
        console.log(`Published: ${new Date(pin.publishedAt).toLocaleString()}`);
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      pin.variations.forEach((variation, index) => {
        console.log(`📌 PIN ${index + 1}: ${variation.angle}\n`);
        console.log(`Title: ${variation.title}`);
        console.log(`Description: ${variation.description}`);
        console.log(`Link: ${variation.link}`);
        console.log(`Board: ${variation.boardName}`);
        if (variation.imageUrl) {
          console.log(`Image: ${variation.imageUrl.substring(0, 80)}...`);
        }
        console.log(`Alt Text: ${variation.altText}\n`);
      });

      console.log(`🏷️  Tags: ${pin.suggestedTags.join(', ')}`);

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      console.log('💡 NEXT STEPS:');
      if (pin.status === 'draft') {
        console.log(`1. Review the pins above`);
        console.log(`2. To approve: npm run review-pins ${pinId} approve`);
        console.log(`3. To export as CSV: npm run review-pins ${pinId} export`);
      } else if (pin.status === 'approved') {
        console.log(`1. Pins have been approved`);
        console.log(`2. To export as CSV: npm run review-pins ${pinId} export`);
        console.log(`3. Upload to Pinterest using the CSV file`);
      }

      console.log(`\n📊 View all pins: npm run review-pins list\n`);
    } else if (action === 'approve') {
      if (pin.status === 'approved') {
        console.log(`✅ Pins are already approved`);
        process.exit(0);
      }

      storageService.approvePinDraft(pinId);
      console.log(`✅ Pins approved successfully!\n`);
      console.log(`Next: npm run review-pins ${pinId} export`);
      console.log(`Then upload to Pinterest: https://www.pinterest.com/pin/create/bulk/\n`);
    } else if (action === 'export') {
      // Export pins in Pinterest's new bulk upload format (V2)
      // Only include the minimal required columns for organic pins
      const headers = [
        'Campaign Name',
        'Ad Group Name',
        'Promoted Pin Name',
        'Pin Title',
        'Pin Description',
        'Media File Name',
        'Organic Pin URL',
        'Image Alternative Text'
      ];

      // Format tags for appending to description (Pinterest best practice for discoverability)
      const formatTags = (tags: string[], maxTags: number = 5): string => {
        if (!tags || tags.length === 0) return '';
        const formattedTags = tags
          .slice(0, maxTags)
          .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`)
          .filter(tag => tag.length > 1);
        return formattedTags.length > 0 ? '\n\n' + formattedTags.join(' ') : '';
      };

      const tagsString = formatTags(pin.suggestedTags, 5);
      const rows: string[][] = [];
      const campaignName = `${pin.articleTitle.substring(0, 50)}_Campaign`;
      const adGroupName = `${pin.articleTitle.substring(0, 40)}_AdGroup`;

      pin.variations.forEach((variation, index) => {
        // Append tags to description for Pinterest discoverability
        const descriptionWithTags = (variation.description + tagsString).substring(0, 500);

        rows.push([
          campaignName,
          adGroupName,
          `Pin_${index + 1}_${variation.angle.replace(/\//g, '_')}`,
          variation.title,
          descriptionWithTags,
          variation.imageUrl || '', // Pinterest prefers image URLs in the bulk format
          variation.link,
          variation.altText
        ]);
      });

      const csv = [
        headers.join(','),
        ...rows.map(row =>
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      const exportDir = 'pin_exports';
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const exportPath = path.join(exportDir, `${pinId}_${timestamp}.csv`);
      fs.writeFileSync(exportPath, csv);

      console.log(`\n✅ Pins exported to Pinterest format!\n`);
      console.log(`📁 File: ${exportPath}\n`);
      console.log(`📋 PIN UPLOAD INSTRUCTIONS:`);
      console.log(`1. Go to Pinterest Ads Manager:`);
      console.log(`   https://ads.pinterest.com/`);
      console.log(`2. Click "Create" → "Bulk upload"`);
      console.log(`3. Click "Upload a file" and select: ${exportPath}`);
      console.log(`4. Review the pins in the preview`);
      console.log(`5. Click "Publish" to upload all ${pin.variations.length} pins\n`);
      console.log(`📊 CSV Preview (first pin):`);
      console.log(headers.join(' | '));
      if (rows.length > 0) {
        console.log(rows[0].map(c => c.substring(0, 25)).join(' | '));
      }
      console.log();
    } else {
      console.error(`❌ Unknown action: ${action}`);
      console.error('Available actions: view, approve, export');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
