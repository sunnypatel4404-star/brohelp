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
        age_group: ageGroup,
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
          age_group: ageGroup,
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
    // Clean emoji, HTML, and extra characters
    const clean = this.stripHtml(title).replace(/[^\w\s-]/g, '').trim();

    // Look for common benefit patterns
    const patterns = [
      /(?:how to|guide to|tips for)\s+(.+?)(?:\s+for|\s+in|\s+with|\s+through|$)/i,
      /(.+?)\s+(?:tips|guide|strategies|help|advice)(?:\s|$)/i,
      /help(?:ing)?\s+(?:your\s+)?(?:child|toddler|kids?|baby|infant)\s+(.+?)(?:\s+for|\s+in|\s+with|$)/i,
      /^(.+?)\s+(?:through|with|for|and)(?:\s|$)/i
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match && match[1] && match[1].trim().length > 3) {
        return match[1].toLowerCase().trim();
      }
    }

    // Fallback: extract meaningful words from title
    const words = clean
      .split(' ')
      .filter(w => w.length > 2 && !this.isStopWord(w))
      .slice(0, 4)
      .join(' ')
      .toLowerCase();
    return words || title.toLowerCase();
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'for', 'with', 'your', 'how', 'tips', 'guide', 'creating', 'building'];
    return stopWords.includes(word.toLowerCase());
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')   // Replace &nbsp; with space
      .replace(/&amp;/g, '&')    // Decode common entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
  }

  /**
   * Extract action from article content
   */
  private extractAction(title: string): string {
    const clean = this.stripHtml(title).toLowerCase();

    // Common action verb patterns with context
    const actionPatterns = [
      /(?:how to|tips for|guide to)\s+(\w+(?:\s+\w+){0,2})/i,
      /(balanc(?:e|ing)|manag(?:e|ing)|navigat(?:e|ing)|establish(?:ing)?|creat(?:e|ing)|build(?:ing)?|develop(?:ing)?|support(?:ing)?|help(?:ing)?|teach(?:ing)?|guid(?:e|ing))\s+\w+/i
    ];

    for (const pattern of actionPatterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: use the benefit as action context
    const benefit = this.extractBenefit(title);
    return benefit || title.substring(0, 30);
  }

  /**
   * Extract specific detail from excerpt or content
   */
  private extractDetail(text: string): string {
    // Strip HTML tags first
    const cleanedText = this.stripHtml(text);

    // Split into sentences and find the first meaningful one
    const sentences = cleanedText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Filter out very short sentences

    if (sentences.length === 0) {
      return cleanedText.substring(0, 80);
    }

    // Take first sentence and clean it
    let firstSentence = sentences[0];

    // Remove common prefixes
    firstSentence = firstSentence
      .replace(/^(introduction|overview|learn|discover|find out):\s*/i, '')
      .trim();

    // Extract key phrase (meaningful words, max 12 words or 80 chars)
    const words = firstSentence
      .split(' ')
      .filter(w => w.length > 1)
      .slice(0, 12)
      .join(' ');

    const result = words.substring(0, 80);
    return result || firstSentence.substring(0, 80);
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
    // Strip HTML and remove emoji
    const cleaned = this.stripHtml(title)
      .replace(/[^\w\s-]/g, ' ')
      .replace(/(how to|tips for|guide to|for|in|the|a|an|creating|building)\s+/gi, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2 && !this.isStopWord(w))
      .slice(0, 4)
      .join(' ');

    return cleaned.trim() || this.stripHtml(title).substring(0, 30) || 'Parenting';
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
    const titleLower = this.stripHtml(title).toLowerCase();

    // Look for problem indicators with better matching
    const problemMap: { [key: string]: string } = {
      'screen time': 'spending too much time on screens',
      'screen': 'having screen time challenges',
      'struggling': 'struggling with routines',
      'difficult': 'dealing with challenging behaviors',
      'challenging': 'facing daily challenges',
      'sleep': 'having sleep difficulties',
      'bedtime': 'resistant to bedtime',
      'picky eat': 'a picky eater',
      'eating': 'having mealtime struggles',
      'tantrum': 'dealing with tantrums',
      'behavior': 'showing challenging behaviors',
      'sibling': 'managing sibling rivalry',
      'potty': 'potty training',
      'warm': 'struggling to stay warm',
      'cold': 'dealing with cold weather'
    };

    for (const [keyword, problem] of Object.entries(problemMap)) {
      if (titleLower.includes(keyword)) {
        return problem;
      }
    }

    // Fallback: use a generic but relevant problem based on title
    const topic = this.extractTopic(title);
    return `navigating ${topic}`;
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
