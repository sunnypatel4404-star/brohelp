import { SavedPin, PinMetadata } from '../config/pinConfig';
import { getDatabase, PinRow, PinVariationRow } from '../database/database';

export class PinStorageService {
  // storageDir kept for backward compatibility but not used
  private storageDir: string;

  constructor(storageDir: string = './saved_pins') {
    this.storageDir = storageDir;
    // Database is initialized on first access via getDatabase()
  }

  /**
   * Save pin draft to database
   */
  savePinDraft(pin: SavedPin): string {
    const db = getDatabase();

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

    pin.variations.forEach((v, i) => {
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

    console.log(`📁 Pin draft saved: ${pin.id}`);

    return pin.id;
  }

  /**
   * Load pin draft from database
   */
  loadPinDraft(pinId: string): SavedPin | null {
    const db = getDatabase();

    const pinRow = db.prepare('SELECT * FROM pins WHERE id = ?').get(pinId) as PinRow | undefined;

    if (!pinRow) {
      return null;
    }

    const variationRows = db.prepare(
      'SELECT * FROM pin_variations WHERE pin_id = ? ORDER BY sort_order'
    ).all(pinId) as PinVariationRow[];

    return this.rowToSavedPin(pinRow, variationRows);
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

    // Delete and re-insert (simpler than partial updates for variations)
    this.deletePinDraft(pinId);
    this.savePinDraft(updated);

    return updated;
  }

  /**
   * Approve a pin draft (change status to approved)
   */
  approvePinDraft(pinId: string, notes?: string): SavedPin | null {
    return this.updatePinStatus(pinId, 'approved', notes);
  }

  /**
   * Mark pin as published
   */
  publishPin(pinId: string): SavedPin | null {
    return this.updatePinStatus(pinId, 'published');
  }

  /**
   * List all pin drafts
   */
  listPinDrafts(): SavedPin[] {
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
   * List pins by status
   */
  listPinsByStatus(status: 'draft' | 'approved' | 'published'): SavedPin[] {
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
   * Get recently created pins
   */
  getRecentPins(count: number = 5): SavedPin[] {
    const db = getDatabase();

    const pinRows = db.prepare(
      'SELECT * FROM pins ORDER BY created_at DESC LIMIT ?'
    ).all(count) as PinRow[];

    return pinRows.map(pinRow => {
      const variationRows = db.prepare(
        'SELECT * FROM pin_variations WHERE pin_id = ? ORDER BY sort_order'
      ).all(pinRow.id) as PinVariationRow[];

      return this.rowToSavedPin(pinRow, variationRows);
    });
  }

  /**
   * Delete a pin draft
   */
  deletePinDraft(pinId: string): boolean {
    const db = getDatabase();

    const result = db.prepare('DELETE FROM pins WHERE id = ?').run(pinId);
    // Variations are deleted automatically via CASCADE

    if (result.changes > 0) {
      console.log(`🗑️  Pin draft deleted: ${pinId}`);
      return true;
    }

    return false;
  }

  /**
   * Export pins to CSV for Pinterest bulk upload
   * Format updated to match Pinterest template (10/15/25)
   * Required fields: Title, Media URL, Pinterest board
   * Optional fields: Description, Link, Publish date, Keywords
   */
  exportPinsToCsv(status?: 'draft' | 'approved' | 'published'): string {
    let pins = this.listPinDrafts();

    if (status) {
      pins = pins.filter(pin => pin.status === status);
    }

    // Pinterest CSV template headers (updated 10/15/25)
    const headers = [
      'Title',              // Required: Pin title (max 100 characters)
      'Media URL',          // Required: Publicly available image URL
      'Pinterest board',    // Required: Board name
      'Description',        // Optional: max 500 characters
      'Link',               // Optional: Destination URL
      'Publish date',       // Optional: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
      'Keywords'            // Optional: Comma-separated keywords
    ];

    const rows = [];
    for (const pin of pins) {
      for (const variation of pin.variations) {
        // Title: Max 100 characters
        const title = variation.title.substring(0, 100);

        // Media URL: Image URL (must be publicly available)
        const mediaUrl = variation.imageUrl || '';

        // Pinterest board: Board name
        const boardName = variation.boardName || 'Parenting Tips';

        // Description: Include hashtags, max 500 characters
        const tagsForDescription = this.formatTagsForDescription(pin.suggestedTags, 5);
        const descriptionWithTags = variation.description + tagsForDescription;
        const description = descriptionWithTags.substring(0, 500);

        // Link: Destination URL
        const link = variation.link || '';

        // Publish date: Empty for immediate publish, or YYYY-MM-DD for scheduling
        const publishDate = '';

        // Keywords: Comma-separated tags (no # symbols for this field)
        const keywords = pin.suggestedTags
          .map(tag => tag.replace(/^#/, ''))
          .join(', ');

        rows.push([
          title,
          mediaUrl,
          boardName,
          description,
          link,
          publishDate,
          keywords
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
   * Format tags for Pinterest description
   */
  private formatTagsForDescription(tags: string[], maxTags: number = 5): string {
    if (!tags || tags.length === 0) return '';

    const formattedTags = tags
      .slice(0, maxTags)
      .map(tag => {
        const cleaned = tag.trim();
        return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
      })
      .filter(tag => tag.length > 1);

    return formattedTags.length > 0 ? '\n\n' + formattedTags.join(' ') : '';
  }

  /**
   * Get storage directory path (kept for backward compatibility)
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Update pin status
   */
  updatePinStatus(pinId: string, newStatus: 'draft' | 'approved' | 'published', notes?: string): SavedPin | null {
    const db = getDatabase();

    const pin = this.loadPinDraft(pinId);

    if (!pin) {
      return null;
    }

    const now = new Date().toISOString();
    let approvedAt = pin.approvedAt;
    let publishedAt = pin.publishedAt;

    if (newStatus === 'approved') {
      approvedAt = now;
    } else if (newStatus === 'published') {
      publishedAt = now;
    }

    db.prepare(`
      UPDATE pins
      SET status = ?, approved_at = ?, published_at = ?, notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(newStatus, approvedAt, publishedAt, notes ?? null, pinId);

    return this.loadPinDraft(pinId);
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
    const db = getDatabase();

    const result = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM pins
    `).get() as { total: number; draft: number; approved: number; published: number };

    return {
      total: result.total || 0,
      draft: result.draft || 0,
      approved: result.approved || 0,
      published: result.published || 0
    };
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
