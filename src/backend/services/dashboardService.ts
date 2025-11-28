import * as fs from 'fs';
import * as path from 'path';
import { SavedPin } from '../config/pinConfig';

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
  private pinsDir: string;
  private imagesDir: string;

  constructor(pinsDir: string = './saved_pins', imagesDir: string = './generated_images') {
    this.pinsDir = pinsDir;
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
   * Get aggregated statistics
   */
  private getStats(): DashboardStats {
    const pins = this.loadAllPins();

    return {
      articles: {
        total: 0, // Would need WordPress integration to get real count
        drafts: 0,
        published: 0
      },
      pins: {
        total: pins.length,
        draft: pins.filter(p => p.status === 'draft').length,
        approved: pins.filter(p => p.status === 'approved').length,
        published: pins.filter(p => p.status === 'published').length
      },
      images: {
        total: this.getGeneratedImages().length
      }
    };
  }

  /**
   * Load all pin drafts
   */
  private loadAllPins(): SavedPin[] {
    if (!fs.existsSync(this.pinsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.pinsDir).filter(f => f.endsWith('.json'));

    return files
      .map(file => {
        try {
          const content = fs.readFileSync(
            path.join(this.pinsDir, file),
            'utf-8'
          );
          return JSON.parse(content) as SavedPin;
        } catch {
          return null;
        }
      })
      .filter((pin): pin is SavedPin => pin !== null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  /**
   * Get all generated images
   */
  private getGeneratedImages(): string[] {
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

    // Add image items
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
   * Get pins by status
   */
  getPinsByStatus(status: 'draft' | 'approved' | 'published'): SavedPin[] {
    return this.loadAllPins().filter(p => p.status === status);
  }

  /**
   * Get summary by topic
   */
  getSummaryByTopic(): Record<string, { pinCount: number; images: number }> {
    const pins = this.loadAllPins();
    const summary: Record<string, { pinCount: number; images: number }> = {};

    pins.forEach(pin => {
      const topic = pin.articleTitle;
      if (!summary[topic]) {
        summary[topic] = { pinCount: 0, images: 0 };
      }
      summary[topic].pinCount += pin.variations.length;
    });

    return summary;
  }

  /**
   * Get activity timeline
   */
  getActivityTimeline(days: number = 7): Array<{ date: string; count: number }> {
    const pins = this.loadAllPins();
    const timeline: Record<string, number> = {};

    const now = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      timeline[dateStr] = 0;
    }

    pins.forEach(pin => {
      const dateStr = pin.createdAt.split('T')[0];
      if (dateStr in timeline) {
        timeline[dateStr]++;
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
}
