import dotenv from 'dotenv';
import { DashboardService } from '../services/dashboardService';

dotenv.config();

function printHeader(title: string): void {
  const width = 60;
  console.log(`\n${'═'.repeat(width)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(width)}\n`);
}

function printSection(title: string): void {
  console.log(`\n📍 ${title}`);
  console.log(`${'-'.repeat(50)}\n`);
}

async function main() {
  const command = process.argv[2] || 'summary';

  try {
    const dashboard = new DashboardService();

    switch (command) {
      case 'summary':
        displaySummary(dashboard);
        break;
      case 'pins':
        displayPinReport(dashboard);
        break;
      case 'stats':
        displayStats(dashboard);
        break;
      case 'timeline':
        displayTimeline(dashboard);
        break;
      case 'full':
        displayFull(dashboard);
        break;
      case 'help':
        displayHelp();
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        displayHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function displaySummary(dashboard: DashboardService): void {
  printHeader('📊 PARENT VILLAGE - CONTENT DASHBOARD');

  const data = dashboard.getDashboardData();

  printSection('PIN STATISTICS');
  console.log(`  📌 Total Pins: ${data.stats.pins.total}`);
  console.log(`  📝 Drafts: ${data.stats.pins.draft} pins`);
  console.log(`  ✅ Approved: ${data.stats.pins.approved} pins`);
  console.log(`  🚀 Published: ${data.stats.pins.published} pins`);

  printSection('IMAGE GENERATION');
  console.log(`  🖼️  Generated Images: ${data.stats.images.total}`);

  if (data.recentContent.length > 0) {
    printSection('RECENT ACTIVITY');
    data.recentContent.slice(0, 5).forEach((item, index) => {
      const icon = item.type === 'pin' ? '📌' : '🖼️';
      const status =
        item.type === 'pin' ? `[${item.status.toUpperCase()}]` : '[✓]';
      console.log(`  ${index + 1}. ${icon} ${item.title}`);
      console.log(
        `     ${status} • ${new Date(item.createdAt).toLocaleDateString()}`
      );
      if (item.pinCount) {
        console.log(`     ${item.pinCount} variations`);
      }
      console.log('');
    });
  }

  printSection('QUICK ACTIONS');
  console.log(`  Generate article:  npm run generate-article "topic"`);
  console.log(`  Generate pins:     npm run generate-pins "topic" [post_id]`);
  console.log(`  View full report:  npm run dashboard pins`);
  console.log(`  See stats:         npm run dashboard stats`);

  console.log(`\n${'═'.repeat(60)}\n`);
}

function displayPinReport(dashboard: DashboardService): void {
  printHeader('📌 PIN MANAGEMENT REPORT');

  const data = dashboard.getDashboardData();

  // Draft pins
  const draftPins = data.allPins.filter(p => p.status === 'draft');
  printSection(`DRAFT PINS (${draftPins.length})`);
  if (draftPins.length === 0) {
    console.log('  No draft pins. Create your first pins!');
  } else {
    draftPins.forEach((pin, index) => {
      console.log(`  ${index + 1}. ${pin.articleTitle}`);
      console.log(`     ID: ${pin.id}`);
      console.log(`     Variations: ${pin.variations.length}`);
      console.log(`     Created: ${new Date(pin.createdAt).toLocaleDateString()}`);
      console.log('');
    });
  }

  // Approved pins
  const approvedPins = data.allPins.filter(p => p.status === 'approved');
  printSection(`APPROVED PINS (${approvedPins.length})`);
  if (approvedPins.length === 0) {
    console.log('  No approved pins yet.');
  } else {
    approvedPins.forEach((pin, index) => {
      console.log(`  ${index + 1}. ${pin.articleTitle}`);
      console.log(
        `     Approved: ${new Date(pin.approvedAt || '').toLocaleDateString()}`
      );
      console.log('');
    });
  }

  // Published pins
  const publishedPins = data.allPins.filter(p => p.status === 'published');
  printSection(`PUBLISHED PINS (${publishedPins.length})`);
  if (publishedPins.length === 0) {
    console.log('  No published pins yet.');
  } else {
    publishedPins.forEach((pin, index) => {
      console.log(`  ${index + 1}. ${pin.articleTitle}`);
      console.log(
        `     Published: ${new Date(pin.publishedAt || '').toLocaleDateString()}`
      );
      console.log('');
    });
  }

  console.log(`${'═'.repeat(60)}\n`);
}

function displayStats(dashboard: DashboardService): void {
  printHeader('📈 CONTENT STATISTICS');

  const data = dashboard.getDashboardData();

  // Overall stats
  printSection('OVERVIEW');
  console.log(`  Total Pins Generated: ${data.stats.pins.total}`);
  console.log(
    `  Completion Rate: ${data.stats.pins.total > 0 ? ((data.stats.pins.published / data.stats.pins.total) * 100).toFixed(0) : 0}%`
  );
  console.log(`  Images Generated: ${data.stats.images.total}`);

  // By topic
  const byTopic = dashboard.getDashboardData().allPins.reduce(
    (acc: Record<string, number>, pin) => {
      acc[pin.articleTitle] = (acc[pin.articleTitle] || 0) + pin.variations.length;
      return acc;
    },
    {}
  );

  if (Object.keys(byTopic).length > 0) {
    printSection('PINS BY TOPIC');
    Object.entries(byTopic)
      .sort((a, b) => b[1] - a[1])
      .forEach(([topic, count]) => {
        console.log(`  • ${topic}: ${count} pins`);
      });
  }

  // Timeline
  const timeline = dashboard.getActivityTimeline(7);
  printSection('ACTIVITY (LAST 7 DAYS)');
  timeline.forEach(day => {
    const bar = '█'.repeat(day.count || 0);
    console.log(`  ${day.date}: ${bar} ${day.count || 0}`);
  });

  console.log(`\n${'═'.repeat(60)}\n`);
}

function displayTimeline(dashboard: DashboardService): void {
  printHeader('📅 ACTIVITY TIMELINE');

  const timeline = dashboard.getActivityTimeline(30);

  printSection('LAST 30 DAYS');
  timeline.forEach(day => {
    const bar = '█'.repeat(Math.min(day.count, 20));
    const spaces = ' '.repeat(Math.max(0, 20 - day.count));
    console.log(`  ${day.date}: ${bar}${spaces} ${day.count}`);
  });

  console.log(`\n${'═'.repeat(60)}\n`);
}

function displayFull(dashboard: DashboardService): void {
  displaySummary(dashboard);
  displayPinReport(dashboard);
  displayStats(dashboard);
}

function displayHelp(): void {
  console.log(`
📊 Dashboard Commands

Usage: npm run dashboard [command]

Commands:
  summary   Show overview dashboard (default)
  pins      Show detailed pin management report
  stats     Show content statistics
  timeline  Show 30-day activity timeline
  full      Show everything
  help      Show this help message

Examples:
  npm run dashboard              # Show summary
  npm run dashboard pins         # Show pin report
  npm run dashboard stats        # Show statistics
  npm run dashboard timeline     # Show timeline

  `);
}

main();
