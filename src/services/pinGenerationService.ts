import { pinVariations, PinMetadata, SavedPin, parentVillagePinConfig } from '../config/pinConfig';

interface ArticleData {
  title: string;
  content: string;
  excerpt?: string;
  postId?: number;
  blogUrl?: string;
  imageUrl?: string;
}

export class PinGenerationService {
  private blogUrl: string;

  constructor(blogUrl: string = 'https://parentvillage.blog') {
    this.blogUrl = blogUrl.replace(/\/$/, '');
  }

  /**
   * Generate multiple pin variations from an article
   */
  generatePinVariations(article: ArticleData): PinMetadata[] {
    const pins: PinMetadata[] = [];

    // Extract key information from article
    const benefit = this.extractBenefit(article.title);
    const action = this.extractAction(article.title);
    const detail = this.extractDetail(article.excerpt || article.content);
    const ageGroup = this.detectAgeGroup(article.content);
    const topic = this.extractTopic(article.title);
    const number = this.suggestNumber();
    const problem = this.extractProblem(article.title);

    // Generate a pin for each variation
    pinVariations.forEach((variation) => {
      const title = this.interpolateTemplate(variation.titleTemplate, {
        benefit,
        action,
        detail,
        ageGroup,
        topic,
        number,
        problem
      });

      const cta = this.selectCta();
      const description = this.interpolateTemplate(
        variation.descriptionTemplate,
        {
          benefit,
          action,
          detail,
          ageGroup,
          topic,
          number,
          problem,
          cta
        }
      );

      const pin: PinMetadata = {
        title: this.truncate(title, parentVillagePinConfig.titleMaxChars),
        description: this.truncate(
          description,
          parentVillagePinConfig.descriptionMaxChars
        ),
        link: this.generatePostLink(article),
        imageUrl: article.imageUrl,
        altText: this.generateAltText(article.title, ageGroup),
        boardName: this.generateBoardName(article.title),
        angle: variation.angle
      };

      pins.push(pin);
    });

    return pins;
  }

  /**
   * Extract main benefit from title or content
   */
  private extractBenefit(title: string): string {
    // Clean emoji and extra characters
    let clean = title.replace(/[^\w\s-]/g, '').trim();

    // Look for common benefit patterns
    const patterns = [
      /how to (.+?) (?:for|in|with|through)/i,
      /(.+?) (?:tips|guide|strategies|help)/i,
      /help(?:ing)? (?:your )?\w+ (.+)/i,
      /^(.+?) (?:through|with|for)/i
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match && match[1].trim().length > 2) {
        return match[1].toLowerCase().trim();
      }
    }

    // Fallback: extract first 3-5 meaningful words
    const words = clean.split(' ')
      .filter(w => w.length > 2)
      .slice(0, 5)
      .join(' ')
      .toLowerCase();
    return words || 'parenting success';
  }

  /**
   * Extract action from article content
   */
  private extractAction(title: string): string {
    // Common action verbs in parenting content
    const actionPatterns = [
      /balance|manage|navigate|set|establish|create/i,
      /encourage|foster|build|develop|support|help|teach|guide/i
    ];

    for (const pattern of actionPatterns) {
      if (pattern.test(title)) {
        const match = title.match(pattern);
        if (match) return match[0].toLowerCase();
      }
    }

    return 'balance screen time';
  }

  /**
   * Extract specific detail from excerpt or content
   */
  private extractDetail(text: string): string {
    // Take first meaningful phrase
    const sentences = text.split('.');
    const firstSentence = sentences[0]?.trim() || '';

    // Clean emoji and special characters
    const clean = firstSentence.replace(/[^\w\s-]/g, '').trim();

    // Extract key phrase (take meaningful words, max 10)
    const words = clean
      .split(' ')
      .filter(w => w.length > 2)
      .slice(0, 10)
      .join(' ')
      .toLowerCase();
    return words.substring(0, 60) || 'child development tips';
  }

  /**
   * Detect age group from content
   */
  private detectAgeGroup(content: string): string {
    const contentLower = content.toLowerCase();

    for (const [group, keywords] of Object.entries(
      parentVillagePinConfig.ageGroupKeywords
    )) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          return group;
        }
      }
    }

    return 'child'; // Default
  }

  /**
   * Extract main topic from title
   */
  private extractTopic(title: string): string {
    // Remove emoji and common words
    const cleaned = title
      .replace(/[^\w\s-]/g, '')
      .replace(/(how to|tips|guide|for|in|the|a|an)/gi, '')
      .trim()
      .split(' ')
      .filter(w => w.length > 2)
      .slice(0, 4)
      .join(' ');

    return cleaned.trim() || 'Parenting';
  }

  /**
   * Suggest a number for listicle pins
   */
  private suggestNumber(): string {
    const numbers = ['3', '5', '7', '10', '12'];
    return numbers[Math.floor(Math.random() * numbers.length)];
  }

  /**
   * Extract problem statement from title
   */
  private extractProblem(title: string): string {
    const titleLower = title.toLowerCase();

    // Look for problem indicators with better matching
    if (titleLower.includes('screen time') || titleLower.includes('screen'))
      return 'spending too much time on screens';
    if (titleLower.includes('struggling'))
      return 'struggling with bedtime';
    if (titleLower.includes('difficult') || titleLower.includes('challenging'))
      return 'dealing with tantrums';
    if (titleLower.includes('sleep') || titleLower.includes('bedtime'))
      return 'resistant to bedtime';
    if (titleLower.includes('picky') || titleLower.includes('eating'))
      return 'a picky eater';
    if (titleLower.includes('parent') && titleLower.includes('newborn'))
      return 'adjusting to parenthood';
    if (titleLower.includes('sibling'))
      return 'managing sibling rivalry';

    return 'feeling overwhelmed as a parent';
  }

  /**
   * Select a CTA for the pin
   */
  private selectCta(): string {
    const ctaOptions = [
      parentVillagePinConfig.defaultCta,
      ...parentVillagePinConfig.altCtaOptions
    ];

    return ctaOptions[Math.floor(Math.random() * ctaOptions.length)];
  }

  /**
   * Interpolate template with values
   */
  private interpolateTemplate(
    template: string,
    values: Record<string, string>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(values)) {
      const placeholder = `{${key}}`;
      // Only replace if value is meaningful (not just the placeholder name)
      const replacementValue = value && value.trim().length > 0 ? value : '';
      result = result.replace(new RegExp(placeholder, 'g'), replacementValue);
    }

    // Clean up any double spaces or extra spacing created by empty placeholders
    result = result.replace(/\s+/g, ' ').trim();

    // Remove any remaining unfilled placeholders
    result = result.replace(/{[a-z_]+}/gi, '').trim();

    return result;
  }

  /**
   * Truncate text to max length
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate alt text for image
   */
  private generateAltText(title: string, ageGroup: string): string {
    const cleanTitle = title.replace(/[^\w\s-]/g, '').trim();
    return `Illustration: ${cleanTitle} - Parent Village parenting tips for ${ageGroup}s`;
  }

  /**
   * Generate post link
   */
  private generatePostLink(article: ArticleData): string {
    if (article.postId) {
      return `${this.blogUrl}/?p=${article.postId}`;
    }

    // Fallback: generate slug from title
    const slug = article.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${this.blogUrl}/${slug}/`;
  }

  /**
   * Generate board name
   */
  private generateBoardName(topic: string): string {
    // Use full article title with clean emoji removal
    let boardName = topic
      .replace(/[^\w\s-]/g, '') // Remove emoji
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Limit to 50 chars for readability
    if (boardName.length > 50) {
      boardName = boardName.substring(0, 50).trim();
    }

    return boardName || 'Parenting Tips';
  }

  /**
   * Generate suggested tags based on content
   */
  generateTags(
    article: ArticleData,
    ageGroup: string,
    includeStandard: boolean = true
  ): string[] {
    const tags: Set<string> = new Set();

    // Add standard tags
    if (includeStandard) {
      parentVillagePinConfig.standardTags.forEach(tag => tags.add(tag));
    }

    // Add age-group specific tags
    const ageGroupTags =
      parentVillagePinConfig.ageGroupTags[ageGroup as keyof typeof parentVillagePinConfig.ageGroupTags];
    if (ageGroupTags) {
      ageGroupTags.forEach(tag => tags.add(tag));
    }

    // Add trending tags
    parentVillagePinConfig.trendingTags.forEach(tag => tags.add(tag));

    // Extract content-specific keywords and create tags
    const keywords = this.extractKeywords(article.content);
    keywords.forEach(keyword => {
      tags.add('#' + keyword.replace(/\s+/g, ''));
    });

    // Return as array, limit to reasonable number
    return Array.from(tags).slice(0, 12);
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const keywords: string[] = [];

    // Look for capitalized phrases (likely titles or key concepts)
    const phrases = content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];

    // Keep unique phrases, max 5 keywords
    const unique = [...new Set(phrases)].slice(0, 5);
    unique.forEach(phrase => {
      if (phrase.length > 2 && phrase.length < 20) {
        keywords.push(phrase.toLowerCase());
      }
    });

    return keywords;
  }

  /**
   * Create a SavedPin object for storage
   */
  createSavedPin(
    article: ArticleData,
    variations: PinMetadata[],
    tags: string[]
  ): SavedPin {
    return {
      id: `pin_${Date.now()}`,
      articleTitle: article.title,
      articleId: article.postId,
      variations,
      suggestedTags: tags,
      createdAt: new Date().toISOString(),
      status: 'draft'
    };
  }
}
