import * as fs from 'fs';
import { SavedPin, PinMetadata } from '../config/pinConfig';
import { getDatabase, PinRow, PinVariationRow, ImageRow } from '../database/database';

export interface DashboardStats {
  articles: {
    total: number;
    drafts: number;
    published: number;
  };
  pins: {
    total: number;
    draft: number;
    approved: number;
    published: number;
  };
  images: {
    total: number;
  };
}

export interface ContentItem {
  id: string;
  type: 'article' | 'pin' | 'image';
  title: string;
  topic?: string;
  status: string;
  createdAt: string;
  url?: string;
  pinCount?: number;
  notes?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentContent: ContentItem[];
  allPins: SavedPin[];
  generatedImages: string[];
}

export class DashboardService {
  private imagesDir: string;

  constructor(_pinsDir: string = './saved_pins', imagesDir: string = './generated_images') {
    this.imagesDir = imagesDir;
  }

  /**
   * Get all dashboard data
   */
  getDashboardData(): DashboardData {
    const stats = this.getStats();
    const allPins = this.loadAllPins();
    const generatedImages = this.getGeneratedImages();
    const recentContent = this.getRecentContent(allPins, generatedImages);

    return {
      stats,
      recentContent,
      allPins,
      generatedImages
    };
  }

  /**
   * Get aggregated statistics using SQL
   */
  private getStats(): DashboardStats {
    const db = getDatabase();

    // Get pin stats in one query
    const pinStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM pins
    `).get() as { total: number; draft: number; approved: number; published: number };

    // Get image count from database
    const imageStats = db.prepare('SELECT COUNT(*) as total FROM images').get() as { total: number };

    return {
      articles: {
        total: 0, // Would need WordPress integration to get real count
        drafts: 0,
        published: 0
      },
      pins: {
        total: pinStats.total || 0,
        draft: pinStats.draft || 0,
        approved: pinStats.approved || 0,
        published: pinStats.published || 0
      },
      images: {
        total: imageStats.total || 0
      }
    };
  }

  /**
   * Load all pins from database
   */
  private loadAllPins(): SavedPin[] {
    const db = getDatabase();

    const pinRows = db.prepare('SELECT * FROM pins ORDER BY created_at DESC').all() as PinRow[];

    return pinRows.map(pinRow => {
      const variationRows = db.prepare(
        'SELECT * FROM pin_variations WHERE pin_id = ? ORDER BY sort_order'
      ).all(pinRow.id) as PinVariationRow[];

      return this.rowToSavedPin(pinRow, variationRows);
    });
  }

  /**
   * Get all generated images from database
   */
  private getGeneratedImages(): string[] {
    const db = getDatabase();

    const imageRows = db.prepare(
      'SELECT filename FROM images ORDER BY created_at DESC'
    ).all() as { filename: string }[];

    // If database has images, return those
    if (imageRows.length > 0) {
      return imageRows.map(row => row.filename);
    }

    // Fallback to filesystem for backward compatibility
    if (!fs.existsSync(this.imagesDir)) {
      return [];
    }

    return fs
      .readdirSync(this.imagesDir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .reverse();
  }

  /**
   * Get recent content (pins + images)
   */
  private getRecentContent(pins: SavedPin[], images: string[]): ContentItem[] {
    const content: ContentItem[] = [];

    // Add pin items
    pins.slice(0, 10).forEach(pin => {
      content.push({
        id: pin.id,
        type: 'pin',
        title: pin.articleTitle,
        status: pin.status,
        createdAt: pin.createdAt,
        pinCount: pin.variations.length,
        url: pin.variations[0]?.link
      });
    });

    // Add image items (try to get from database first)
    const db = getDatabase();
    const recentImages = db.prepare(
      'SELECT * FROM images ORDER BY created_at DESC LIMIT 10'
    ).all() as ImageRow[];

    if (recentImages.length > 0) {
      recentImages.forEach(image => {
        content.push({
          id: image.filename,
          type: 'image',
          title: image.topic || this.extractTopicFromImage(image.filename),
          status: 'completed',
          createdAt: image.created_at
        });
      });
    } else {
      // Fallback to filename parsing
      images.slice(0, 10).forEach(imageName => {
        const createdAt = this.getImageDate(imageName);
        content.push({
          id: imageName,
          type: 'image',
          title: this.extractTopicFromImage(imageName),
          status: 'completed',
          createdAt
        });
      });
    }

    // Sort by date
    return content.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Extract date from image filename
   */
  private getImageDate(filename: string): string {
    const timestampMatch = filename.match(/_(\d+)\.png$/);
    if (timestampMatch) {
      const timestamp = parseInt(timestampMatch[1], 10);
      return new Date(timestamp).toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * Extract topic from image filename
   */
  private extractTopicFromImage(filename: string): string {
    return filename
      .replace(/_\d+\.png$/, '')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get pins by status using SQL
   */
  getPinsByStatus(status: 'draft' | 'approved' | 'published'): SavedPin[] {
    const db = getDatabase();

    const pinRows = db.prepare(
      'SELECT * FROM pins WHERE status = ? ORDER BY created_at DESC'
    ).all(status) as PinRow[];

    return pinRows.map(pinRow => {
      const variationRows = db.prepare(
        'SELECT * FROM pin_variations WHERE pin_id = ? ORDER BY sort_order'
      ).all(pinRow.id) as PinVariationRow[];

      return this.rowToSavedPin(pinRow, variationRows);
    });
  }

  /**
   * Get summary by topic using SQL
   */
  getSummaryByTopic(): Record<string, { pinCount: number; images: number }> {
    const db = getDatabase();

    const results = db.prepare(`
      SELECT
        p.article_title as topic,
        COUNT(DISTINCT pv.id) as pinCount
      FROM pins p
      LEFT JOIN pin_variations pv ON p.id = pv.pin_id
      GROUP BY p.article_title
    `).all() as Array<{ topic: string; pinCount: number }>;

    const summary: Record<string, { pinCount: number; images: number }> = {};

    results.forEach(row => {
      summary[row.topic] = { pinCount: row.pinCount || 0, images: 0 };
    });

    return summary;
  }

  /**
   * Get activity timeline using SQL
   */
  getActivityTimeline(days: number = 7): Array<{ date: string; count: number }> {
    const db = getDatabase();

    // Generate date range
    const timeline: Record<string, number> = {};
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      timeline[dateStr] = 0;
    }

    // Get pin counts by date
    const pinCounts = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM pins
      WHERE date(created_at) >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at)
    `).all(days) as Array<{ date: string; count: number }>;

    pinCounts.forEach(row => {
      if (row.date in timeline) {
        timeline[row.date] = row.count;
      }
    });

    return Object.entries(timeline)
      .reverse()
      .map(([date, count]) => ({ date, count }));
  }

  /**
   * Get content summary
   */
  getContentSummary(): string {
    const stats = this.getStats();
    const pins = this.loadAllPins();
    const recentPins = pins.slice(0, 3);

    let summary = `\n📊 DASHBOARD SUMMARY\n`;
    summary += `${'═'.repeat(50)}\n\n`;

    summary += `📌 PINTEREST PINS\n`;
    summary += `  Total: ${stats.pins.total}\n`;
    summary += `  📝 Drafts: ${stats.pins.draft}\n`;
    summary += `  ✅ Approved: ${stats.pins.approved}\n`;
    summary += `  🚀 Published: ${stats.pins.published}\n\n`;

    summary += `🖼️  IMAGES\n`;
    summary += `  Generated: ${stats.images.total}\n\n`;

    if (recentPins.length > 0) {
      summary += `📋 RECENT PINS\n`;
      recentPins.forEach((pin, index) => {
        summary += `  ${index + 1}. "${pin.articleTitle}"\n`;
        summary += `     Status: ${pin.status} | Variations: ${pin.variations.length}\n`;
        summary += `     Created: ${new Date(pin.createdAt).toLocaleDateString()}\n\n`;
      });
    }

    summary += `${'═'.repeat(50)}\n`;

    return summary;
  }

  /**
   * Get detailed pin report
   */
  getPinReport(): string {
    const pins = this.loadAllPins();

    let report = `\n📌 PIN MANAGEMENT REPORT\n`;
    report += `${'═'.repeat(50)}\n\n`;

    if (pins.length === 0) {
      report += `No pins generated yet. Create your first article!\n`;
      return report;
    }

    // Group by status
    const byStatus = {
      draft: pins.filter(p => p.status === 'draft'),
      approved: pins.filter(p => p.status === 'approved'),
      published: pins.filter(p => p.status === 'published')
    };

    report += `📝 DRAFT PINS (${byStatus.draft.length})\n`;
    if (byStatus.draft.length === 0) {
      report += `  No draft pins\n`;
    } else {
      byStatus.draft.forEach(pin => {
        report += `  • ${pin.articleTitle}\n`;
        report += `    ID: ${pin.id}\n`;
        report += `    Variations: ${pin.variations.length}\n`;
      });
    }
    report += `\n`;

    report += `✅ APPROVED PINS (${byStatus.approved.length})\n`;
    if (byStatus.approved.length === 0) {
      report += `  No approved pins\n`;
    } else {
      byStatus.approved.forEach(pin => {
        report += `  • ${pin.articleTitle}\n`;
        report += `    Approved: ${new Date(pin.approvedAt || '').toLocaleDateString()}\n`;
      });
    }
    report += `\n`;

    report += `🚀 PUBLISHED PINS (${byStatus.published.length})\n`;
    if (byStatus.published.length === 0) {
      report += `  No published pins\n`;
    } else {
      byStatus.published.forEach(pin => {
        report += `  • ${pin.articleTitle}\n`;
        report += `    Published: ${new Date(pin.publishedAt || '').toLocaleDateString()}\n`;
      });
    }
    report += `\n`;

    report += `${'═'.repeat(50)}\n`;

    return report;
  }

  /**
   * Convert database rows to SavedPin object
   */
  private rowToSavedPin(pinRow: PinRow, variationRows: PinVariationRow[]): SavedPin {
    const variations: PinMetadata[] = variationRows.map(v => ({
      title: v.title,
      description: v.description,
      link: v.link,
      imageUrl: v.image_url ?? undefined,
      altText: v.alt_text ?? '',
      boardName: v.board_name ?? undefined,
      dominantColor: v.dominant_color ?? undefined,
      angle: v.angle
    }));

    return {
      id: pinRow.id,
      articleTitle: pinRow.article_title,
      articleId: pinRow.article_id ?? undefined,
      postId: pinRow.post_id ?? undefined,
      variations,
      suggestedTags: JSON.parse(pinRow.suggested_tags || '[]'),
      createdAt: pinRow.created_at,
      status: pinRow.status as 'draft' | 'approved' | 'published',
      approvedAt: pinRow.approved_at ?? undefined,
      publishedAt: pinRow.published_at ?? undefined,
      notes: pinRow.notes ?? undefined
    };
  }
}
