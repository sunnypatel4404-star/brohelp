/**
 * Internal Linking Service
 * Fetches existing articles from WordPress and provides them for internal linking
 */

import { WordPressXmlRpcService, WordPressSyncedPost } from './wordpressXmlrpcService';

export interface InternalLinkCandidate {
  title: string;
  url: string;
  slug: string;
}

export class InternalLinkingService {
  private wpService: WordPressXmlRpcService;
  private cachedArticles: InternalLinkCandidate[] = [];
  private lastFetchTime: number = 0;
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minute cache

  constructor(wpService: WordPressXmlRpcService) {
    this.wpService = wpService;
  }

  /**
   * Fetch all published articles from WordPress for internal linking
   */
  async fetchExistingArticles(forceRefresh = false): Promise<InternalLinkCandidate[]> {
    const now = Date.now();

    // Use cached articles if still valid
    if (!forceRefresh && this.cachedArticles.length > 0 && (now - this.lastFetchTime) < this.cacheExpiryMs) {
      console.log(`   📚 Using cached articles (${this.cachedArticles.length} articles)`);
      return this.cachedArticles;
    }

    console.log('   📚 Fetching existing articles from WordPress...');

    try {
      // Fetch all published posts
      const posts = await this.wpService.getPosts({
        number: 100,
        status: 'publish'
      });

      this.cachedArticles = posts
        .filter((post: WordPressSyncedPost) => post.title && post.link)
        .map((post: WordPressSyncedPost) => ({
          title: this.cleanTitle(post.title),
          url: post.link,
          slug: post.slug
        }));

      this.lastFetchTime = now;
      console.log(`   📚 Found ${this.cachedArticles.length} published articles for internal linking`);

      return this.cachedArticles;
    } catch (error) {
      console.error('Error fetching articles for internal linking:', error);
      return this.cachedArticles; // Return cached if fetch fails
    }
  }

  /**
   * Clean article title (remove emojis and extra whitespace)
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Format existing articles for GPT prompt
   * Returns a formatted string listing all articles with their URLs
   */
  formatArticlesForPrompt(articles: InternalLinkCandidate[]): string {
    if (articles.length === 0) {
      return '';
    }

    const articleList = articles
      .map((a, i) => `${i + 1}. "${a.title}" - ${a.url}`)
      .join('\n');

    return `
INTERNAL LINKING - IMPORTANT:
You MUST include 2-3 internal links to other articles from our blog within the content.
Choose the most relevant articles based on topic similarity.

Here are our existing articles you can link to:
${articleList}

When adding internal links:
- Use natural anchor text (don't just use "click here")
- Integrate links contextually within paragraphs
- Use HTML format: <a href="URL">anchor text</a>
- Spread links throughout the article, not all in one place
- Only link to articles that are genuinely relevant to the content`;
  }

  /**
   * Get internal linking instructions based on available articles
   */
  async getInternalLinkingInstructions(): Promise<string> {
    const articles = await this.fetchExistingArticles();

    if (articles.length === 0) {
      return ''; // No existing articles to link to
    }

    return this.formatArticlesForPrompt(articles);
  }
}

export default InternalLinkingService;
