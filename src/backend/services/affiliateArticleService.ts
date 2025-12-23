/**
 * Affiliate Article Generator Service
 * Generates product roundup articles with Amazon affiliate links
 *
 * Currently uses manual product entry (API requires 10 sales/30 days)
 * Will auto-switch to PA API once threshold is met
 */

import OpenAI from 'openai';
import 'dotenv/config';
import { AmazonProductService } from './amazonProductService';
import axios from 'axios';

export interface AffiliateProduct {
  name: string;
  asin?: string;
  affiliateLink: string;
  price?: string;
  description?: string;
  whyWeLoveIt?: string;
  imageUrl?: string;
}

export interface AffiliateArticleRequest {
  topic: string;
  products?: AffiliateProduct[];  // If not provided, generates placeholders
  productCount?: number;          // Number of products (default 5)
  internalLinkingInstructions?: string;  // Instructions for adding internal links
}

export interface AffiliateArticle {
  title: string;
  content: string;
  excerpt: string;
  products: AffiliateProduct[];
  isPlaceholder: boolean;  // True if products need manual entry
}

export class AffiliateArticleService {
  private openai: OpenAI;
  private amazonService: AmazonProductService | null = null;
  private partnerTag: string;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.partnerTag = process.env.AMAZON_PARTNER_TAG || 'parentvillage-20';

    // Try to initialize Amazon service (may fail if not eligible)
    try {
      this.amazonService = new AmazonProductService();
    } catch (error) {
      console.log('📝 Amazon PA API not available - using manual product entry mode');
      this.amazonService = null;
    }
  }

  /**
   * Check if Amazon PA API is available
   */
  async isApiAvailable(): Promise<boolean> {
    if (!this.amazonService) return false;

    try {
      // Try a simple search to verify API access
      await this.amazonService.searchProducts({
        keywords: 'test',
        itemCount: 1
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate an affiliate article
   */
  async generateArticle(request: AffiliateArticleRequest): Promise<AffiliateArticle> {
    const { topic, products, productCount = 5, internalLinkingInstructions = '' } = request;

    console.log(`\n📝 Generating affiliate article: "${topic}"`);

    let articleProducts: AffiliateProduct[];
    let isPlaceholder = false;

    if (products && products.length > 0) {
      // Use provided products
      articleProducts = products;
      console.log(`   Using ${products.length} provided products`);
    } else {
      // Check if API is available
      const apiAvailable = await this.isApiAvailable();

      if (apiAvailable && this.amazonService) {
        // Fetch products from Amazon
        console.log(`   Fetching products from Amazon...`);
        const searchKeywords = this.extractSearchKeywords(topic);
        const amazonProducts = await this.amazonService.searchProducts({
          keywords: searchKeywords,
          category: this.getCategoryForTopic(topic),
          itemCount: productCount
        });

        articleProducts = amazonProducts.map(p => ({
          name: p.title,
          asin: p.asin,
          affiliateLink: p.affiliateLink,
          price: p.price ? `$${p.price}` : undefined,
          description: p.features?.slice(0, 2).join(' ') || undefined
        }));
      } else {
        // Generate AI product suggestions (real products, links go to Amazon search)
        console.log(`   Amazon API not available - generating AI product suggestions`);
        articleProducts = await this.generateProductSuggestions(topic, productCount);
        isPlaceholder = true;
      }
    }

    // Generate article content
    const article = await this.generateArticleContent(topic, articleProducts, internalLinkingInstructions);

    return {
      ...article,
      products: articleProducts,
      isPlaceholder
    };
  }

  /**
   * Generate realistic product suggestions using AI
   * These are real product types that exist on Amazon - user just needs to find ASINs
   */
  private async generateProductSuggestions(topic: string, count: number): Promise<AffiliateProduct[]> {
    console.log(`   Generating ${count} product suggestions with AI...`);

    const prompt = `You are helping create an affiliate article about: "${topic}"

Generate ${count} REAL, SPECIFIC product recommendations that actually exist on Amazon.
For each product provide:
1. The exact product name (real brand + product name that exists on Amazon)
2. A realistic price estimate
3. A brief description (1-2 sentences)
4. Why parents love it (1 sentence)

Return as JSON array with this format:
[
  {
    "name": "Brand Name Product Name",
    "price": "$XX.XX",
    "description": "Brief product description",
    "whyWeLoveIt": "Why parents love this"
  }
]

Focus on popular, well-reviewed products that are actually available on Amazon.
Return ONLY the JSON array, no other text.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that recommends real products available on Amazon.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content || '[]';

      // Parse JSON from response (handle markdown code blocks)
      let jsonStr = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        jsonStr = match ? match[1] : content;
      }

      const suggestions = JSON.parse(jsonStr.trim());

      // Map suggestions and fetch images
      const productsWithImages = await Promise.all(
        suggestions.map(async (p: any, i: number) => {
          const productName = p.name || `Product ${i + 1}`;
          const imageUrl = await this.fetchProductImage(productName);

          return {
            name: productName,
            asin: undefined,
            affiliateLink: `https://www.amazon.com/s?k=${encodeURIComponent(productName)}&tag=${this.partnerTag}`,
            price: p.price || '$XX.XX',
            description: p.description || '',
            whyWeLoveIt: p.whyWeLoveIt || '',
            imageUrl
          };
        })
      );

      return productsWithImages;
    } catch (error) {
      console.error('Error generating product suggestions:', error);
      return this.generateFallbackProducts(topic, count);
    }
  }

  /**
   * Fetch product image using Google Custom Search or fallback to placeholder
   */
  private async fetchProductImage(productName: string): Promise<string | undefined> {
    try {
      // Use Google Custom Search API if available
      const googleApiKey = process.env.GOOGLE_API_KEY;
      const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

      if (googleApiKey && searchEngineId) {
        const searchQuery = `${productName} amazon product`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=1`;

        const response = await axios.get(url, { timeout: 10000 });

        if (response.data.items && response.data.items[0]) {
          return response.data.items[0].link;
        }
      }

      // Fallback: Use a placeholder service with product name
      // This creates a nice placeholder that shows the product name
      const encodedName = encodeURIComponent(productName.substring(0, 30));
      return `https://placehold.co/300x300/f5f5f5/666?text=${encodedName}`;

    } catch (error) {
      console.log(`   Using placeholder for: ${productName}`);
      const encodedName = encodeURIComponent(productName.substring(0, 30));
      return `https://placehold.co/300x300/f5f5f5/666?text=${encodedName}`;
    }
  }

  /**
   * Fallback products if AI generation fails
   */
  private generateFallbackProducts(topic: string, count: number): AffiliateProduct[] {
    const products: AffiliateProduct[] = [];

    for (let i = 1; i <= count; i++) {
      products.push({
        name: `[Product ${i} - Search Amazon for "${topic}"]`,
        asin: undefined,
        affiliateLink: `https://www.amazon.com/s?k=${encodeURIComponent(topic)}&tag=${this.partnerTag}`,
        price: '$XX.XX',
        description: 'Add product description after finding on Amazon',
        whyWeLoveIt: 'Add why you love this product'
      });
    }

    return products;
  }

  /**
   * Extract search keywords from topic
   */
  private extractSearchKeywords(topic: string): string {
    // Remove common article title words
    const removeWords = ['best', 'top', 'must-have', 'essential', 'ultimate', 'guide', 'for', 'the', 'a', 'an'];
    const words = topic.toLowerCase().split(/\s+/);
    const keywords = words.filter(w => !removeWords.includes(w));
    return keywords.join(' ');
  }

  /**
   * Get Amazon category for topic
   */
  private getCategoryForTopic(topic: string): string {
    const lowerTopic = topic.toLowerCase();

    if (lowerTopic.includes('book')) return 'Books';
    if (lowerTopic.includes('toy') || lowerTopic.includes('game')) return 'Toys';
    if (lowerTopic.includes('baby') || lowerTopic.includes('infant')) return 'Baby';
    if (lowerTopic.includes('health') || lowerTopic.includes('safety')) return 'HealthPersonalCare';
    if (lowerTopic.includes('outdoor') || lowerTopic.includes('sport')) return 'Sports';

    return 'All';
  }

  /**
   * Generate article content using GPT
   */
  private async generateArticleContent(
    topic: string,
    products: AffiliateProduct[],
    internalLinkingInstructions: string = ''
  ): Promise<{ title: string; content: string; excerpt: string }> {

    const productList = products.map((p, i) =>
      `${i + 1}. ${p.name}
   Price: ${p.price || 'Check Amazon for current price'}
   Link: ${p.affiliateLink}
   Image: ${p.imageUrl || 'No image available'}
   Description: ${p.description || 'Quality product for parents'}
   Why We Love It: ${p.whyWeLoveIt || 'Great value and highly rated'}`
    ).join('\n\n');

    const prompt = `You are writing a helpful product roundup article for Parent Village, a warm and supportive parenting blog.

TOPIC: "${topic}"

PRODUCTS TO FEATURE (use these exact names, prices, and links):
${productList}

Write a complete blog article that:
1. Has an engaging introduction (2-3 paragraphs) explaining why parents need these products
2. Features EACH of the ${products.length} products above with:
   - An H2 heading with the exact product name
   - The product IMAGE (if provided) displayed prominently
   - 2-3 paragraphs about the product benefits (expand on the description provided)
   - A styled "Why We Love It" callout box using the reason provided
   - The EXACT affiliate link provided as a call-to-action button
3. Has a brief conclusion with final recommendations

CRITICAL - USE THESE EXACT FORMATS:

For product images (if Image URL is provided, not "No image available"):
<div style="text-align: center; margin: 20px 0;">
  <a href="EXACT_AFFILIATE_LINK" target="_blank" rel="nofollow sponsored">
    <img src="EXACT_IMAGE_URL" alt="Product Name" style="max-width: 300px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  </a>
</div>

For product links (use the EXACT URL provided for each product):
<p style="text-align: center; margin: 20px 0;">
  <a href="EXACT_LINK_FROM_ABOVE" style="background-color: #FF9900; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;" target="_blank" rel="nofollow sponsored">Check Price on Amazon</a>
</p>

For "Why We Love It" boxes:
<div style="background-color: #FFF5F5; border-left: 4px solid #E91E63; padding: 15px; margin: 20px 0;">
  <strong>💕 Why We Love It:</strong> [use the reason provided above]
</div>

DISCLOSURE - Include this at the very start:
<div style="background-color: #f0f0f0; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
  <em>This post contains affiliate links. If you make a purchase through these links, we may earn a small commission at no extra cost to you. Thank you for supporting Parent Village!</em>
</div>

IMPORTANT:
- Use the EXACT product names provided
- Use the EXACT affiliate links provided (do not modify them)
- Include ALL ${products.length} products
- Keep the tone warm, helpful, and conversational
- Total length: 1200-1500 words
${internalLinkingInstructions}

Return ONLY the HTML content, no markdown code blocks.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful parenting blog writer who creates warm, informative product roundup articles.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000,
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content || '';

    // Extract or generate title
    const titleMatch = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1] : topic;

    // Generate excerpt
    const excerpt = `Discover the ${topic.toLowerCase()}. Our carefully curated list helps parents find the perfect products for their little ones.`;

    return { title, content, excerpt };
  }

  /**
   * Create affiliate link from ASIN
   */
  createAffiliateLink(asin: string): string {
    return `https://www.amazon.com/dp/${asin}?tag=${this.partnerTag}`;
  }

  /**
   * Get suggested affiliate article topics
   */
  static getTopicSuggestions(): string[] {
    return [
      'Best Books for Teaching Kids About Emotions',
      'Top Sensory Toys for Toddlers',
      'Must-Have Baby Products for New Parents',
      'Best Educational Toys for Preschoolers',
      'Top Sleep Training Products That Actually Work',
      'Best Potty Training Supplies',
      'Top Kids Books About Sharing and Kindness',
      'Best Outdoor Toys for Active Kids',
      'Essential Baby Safety Products',
      'Best Montessori Toys for Toddlers',
      'Top Calming Products for Anxious Kids',
      'Best Art Supplies for Creative Kids',
      'Must-Have Products for Picky Eaters',
      'Best Travel Gear for Families with Toddlers',
      'Top STEM Toys for Curious Kids'
    ];
  }
}

export default AffiliateArticleService;
