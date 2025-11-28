import * as fs from 'fs';
import * as path from 'path';
import { SavedPin } from '../config/pinConfig';

export class PinStorageService {
  private storageDir: string;

  constructor(storageDir: string = './saved_pins') {
    this.storageDir = storageDir;

    // Create directory if it doesn't exist
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Save pin draft to JSON file
   */
  savePinDraft(pin: SavedPin): string {
    const filename = `${pin.id}.json`;
    const filepath = path.join(this.storageDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(pin, null, 2));

    console.log(`📁 Pin draft saved: ${filename}`);

    return filepath;
  }

  /**
   * Load pin draft from file
   */
  loadPinDraft(pinId: string): SavedPin | null {
    const filepath = path.join(this.storageDir, `${pinId}.json`);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as SavedPin;
  }

  /**
   * Update pin draft
   */
  updatePinDraft(pinId: string, updates: Partial<SavedPin>): SavedPin | null {
    const pin = this.loadPinDraft(pinId);

    if (!pin) {
      return null;
    }

    const updated = { ...pin, ...updates };
    this.savePinDraft(updated);

    return updated;
  }

  /**
   * Approve a pin draft (change status to approved)
   */
  approvePinDraft(pinId: string, notes?: string): SavedPin | null {
    return this.updatePinDraft(pinId, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      notes
    });
  }

  /**
   * Mark pin as published
   */
  publishPin(pinId: string): SavedPin | null {
    return this.updatePinDraft(pinId, {
      status: 'published',
      publishedAt: new Date().toISOString()
    });
  }

  /**
   * List all pin drafts
   */
  listPinDrafts(): SavedPin[] {
    const files = fs.readdirSync(this.storageDir).filter(f =>
      f.endsWith('.json')
    );

    return files
      .map(file => {
        try {
          const content = fs.readFileSync(
            path.join(this.storageDir, file),
            'utf-8'
          );
          return JSON.parse(content) as SavedPin;
        } catch (error) {
          console.error(`Error reading ${file}:`, error);
          return null;
        }
      })
      .filter((pin): pin is SavedPin => pin !== null);
  }

  /**
   * List pins by status
   */
  listPinsByStatus(status: 'draft' | 'approved' | 'published'): SavedPin[] {
    return this.listPinDrafts().filter(pin => pin.status === status);
  }

  /**
   * Get recently created pins
   */
  getRecentPins(count: number = 5): SavedPin[] {
    return this.listPinDrafts()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, count);
  }

  /**
   * Delete a pin draft
   */
  deletePinDraft(pinId: string): boolean {
    const filepath = path.join(this.storageDir, `${pinId}.json`);

    if (!fs.existsSync(filepath)) {
      return false;
    }

    fs.unlinkSync(filepath);
    console.log(`🗑️  Pin draft deleted: ${pinId}`);

    return true;
  }

  /**
   * Export pins to CSV for manual upload
   */
  exportPinsToCsv(status?: 'draft' | 'approved' | 'published'): string {
    let pins = this.listPinDrafts();

    if (status) {
      pins = pins.filter(pin => pin.status === status);
    }

    const headers = [
      'Article Title',
      'Pin Title',
      'Description',
      'Link',
      'Alt Text',
      'Board Name',
      'Angle',
      'Suggested Tags',
      'Status'
    ];

    const rows = [];
    for (const pin of pins) {
      for (const variation of pin.variations) {
        rows.push([
          pin.articleTitle,
          variation.title,
          variation.description,
          variation.link,
          variation.altText,
          variation.boardName || '',
          variation.angle,
          pin.suggestedTags.join(', '),
          pin.status
        ]);
      }
    }

    const csv = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    return csv;
  }

  /**
   * Get storage directory path
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Update pin status
   */
  updatePinStatus(pinId: string, newStatus: 'draft' | 'approved' | 'published'): SavedPin | null {
    let pin = this.loadPinDraft(pinId);

    if (!pin) {
      return null;
    }

    pin.status = newStatus;

    if (newStatus === 'approved') {
      pin.approvedAt = new Date().toISOString();
    } else if (newStatus === 'published') {
      pin.publishedAt = new Date().toISOString();
    }

    this.savePinDraft(pin);
    return pin;
  }

  /**
   * Get statistics about saved pins
   */
  getStats(): {
    total: number;
    draft: number;
    approved: number;
    published: number;
  } {
    const pins = this.listPinDrafts();

    return {
      total: pins.length,
      draft: pins.filter(p => p.status === 'draft').length,
      approved: pins.filter(p => p.status === 'approved').length,
      published: pins.filter(p => p.status === 'published').length
    };
  }
}
