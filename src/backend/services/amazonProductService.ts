/**
 * Amazon Product Advertising API 5.0 Service
 * Custom implementation with AWS Signature V4 signing
 * Based on working affiliate-bot implementation
 */

import * as crypto from 'crypto';
import 'dotenv/config';

export interface AmazonProduct {
  asin: string;
  title: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  affiliateLink: string;
  rating?: number;
  reviewCount?: number;
  features?: string[];
}

export interface ProductSearchOptions {
  keywords: string;
  category?: string;
  itemCount?: number;
  sortBy?: string;
}

const REGIONS: Record<string, { host: string; region: string; marketplace: string }> = {
  'us-east-1': {
    host: 'webservices.amazon.com',
    region: 'us-east-1',
    marketplace: 'www.amazon.com',
  },
  'us-west-2': {
    host: 'webservices.amazon.com',
    region: 'us-west-2',
    marketplace: 'www.amazon.com',
  },
  'eu-west-1': {
    host: 'webservices.amazon.co.uk',
    region: 'eu-west-1',
    marketplace: 'www.amazon.co.uk',
  },
};

// Common Amazon category browse node IDs
export const BROWSE_NODES: Record<string, string> = {
  electronics: '172282',
  computers: '541966',
  home_kitchen: '1055398',
  sports_outdoors: '3375251',
  clothing: '7141123011',
  beauty: '3760911',
  toys_games: '165793011',
  books: '283155',
  health: '3760901',
  automotive: '15684181',
  pet_supplies: '2619533011',
  office_products: '1064954',
  garden_outdoor: '2972638011',
  baby: '165796011',
  grocery: '16310101',
};

export class AmazonProductService {
  private accessKey: string;
  private secretKey: string;
  private partnerTag: string;
  private region: string;
  private host: string;
  private marketplace: string;

  constructor() {
    this.accessKey = process.env.AMAZON_ACCESS_KEY || '';
    this.secretKey = process.env.AMAZON_SECRET_KEY || '';
    this.partnerTag = process.env.AMAZON_PARTNER_TAG || '';
    this.region = process.env.AMAZON_REGION || 'us-east-1';

    if (!this.accessKey || !this.secretKey || !this.partnerTag) {
      throw new Error(
        'Amazon PA API credentials not configured. Please set AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, and AMAZON_PARTNER_TAG in .env'
      );
    }

    const regionConfig = REGIONS[this.region] || REGIONS['us-east-1'];
    this.host = regionConfig.host;
    this.marketplace = regionConfig.marketplace;
  }

  /**
   * Sign a request using AWS Signature Version 4
   */
  private sign(method: string, uri: string, payload: string, headers: Record<string, string>): Record<string, string> {
    const t = new Date();
    const amzDate = t.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    // Create canonical request
    const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
    const canonicalHeaders =
      `content-encoding:${headers['content-encoding'] || 'amz-1.0'}\n` +
      `content-type:${headers['content-type']}\n` +
      `host:${this.host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:${headers['x-amz-target']}\n`;

    const payloadHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    const canonicalRequest = `${method}\n${uri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.region}/ProductAdvertisingAPI/aws4_request`;
    const stringToSign =
      `${algorithm}\n${amzDate}\n${credentialScope}\n` +
      crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('ProductAdvertisingAPI').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Add authorization header
    const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'x-amz-date': amzDate,
      Authorization: authorization,
    };
  }

  /**
   * Make a signed request to the PA-API
   */
  private async request(operation: string, payload: Record<string, any>): Promise<any> {
    const uri = '/paapi5/' + operation.toLowerCase();
    const url = `https://${this.host}${uri}`;

    payload.PartnerTag = this.partnerTag;
    payload.PartnerType = 'Associates';
    payload.Marketplace = this.marketplace;

    const payloadJson = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'content-type': 'application/json; charset=utf-8',
      'content-encoding': 'amz-1.0',
      'x-amz-target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
    };

    const signedHeaders = this.sign('POST', uri, payloadJson, headers);

    const response = await fetch(url, {
      method: 'POST',
      headers: signedHeaders,
      body: payloadJson,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Amazon API Error Response:', errorBody);
      throw new Error(`Amazon API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for items on Amazon
   */
  async searchProducts(options: ProductSearchOptions): Promise<AmazonProduct[]> {
    const { keywords, category = 'All', itemCount = 5, sortBy = 'Relevance' } = options;

    console.log(`🔍 Searching Amazon for: "${keywords}" in category: ${category}`);

    const payload = {
      Keywords: keywords,
      SearchIndex: category,
      ItemCount: Math.min(itemCount, 10),
      SortBy: sortBy,
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ProductInfo',
        'Offers.Listings.Price',
        'Images.Primary.Large',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
      ],
    };

    const result = await this.request('SearchItems', payload);
    const items = result.SearchResult?.Items || [];
    const products = this.parseItems(items);

    console.log(`   Found ${products.length} products`);
    return products;
  }

  /**
   * Get item details by ASIN
   */
  async getProductsByAsin(asins: string[]): Promise<AmazonProduct[]> {
    console.log(`🔍 Looking up products: ${asins.join(', ')}`);

    const payload = {
      ItemIds: asins.slice(0, 10), // API limit
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ProductInfo',
        'Offers.Listings.Price',
        'Images.Primary.Large',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
      ],
    };

    const result = await this.request('GetItems', payload);
    return this.parseItems(result.ItemsResult?.Items || []);
  }

  /**
   * Parse API response into simplified product objects
   */
  private parseItems(items: any[]): AmazonProduct[] {
    const products: AmazonProduct[] = [];

    for (const item of items) {
      try {
        // Extract price
        let price: number | undefined;
        let currency = 'USD';
        const offers = item.Offers?.Listings || [];
        if (offers.length > 0) {
          const priceInfo = offers[0].Price || {};
          price = priceInfo.Amount;
          currency = priceInfo.Currency || 'USD';
        }

        // Extract rating
        let rating: number | undefined;
        let reviewCount: number | undefined;
        const reviews = item.CustomerReviews || {};
        if (reviews.StarRating) {
          rating = reviews.StarRating.Value;
        }
        if (reviews.Count) {
          reviewCount = reviews.Count;
        }

        const product: AmazonProduct = {
          asin: item.ASIN,
          title: item.ItemInfo?.Title?.DisplayValue || '',
          price,
          currency,
          imageUrl: item.Images?.Primary?.Large?.URL,
          affiliateLink: item.DetailPageURL,
          rating,
          reviewCount,
          features: item.ItemInfo?.Features?.DisplayValues || [],
        };

        products.push(product);
      } catch (error) {
        console.error('Error parsing product:', error);
        continue;
      }
    }

    return products;
  }

  /**
   * Create an affiliate link for an ASIN
   */
  createAffiliateLink(asin: string): string {
    return `https://${this.marketplace}/dp/${asin}?tag=${this.partnerTag}`;
  }

  /**
   * Get parenting-related category suggestions
   */
  static getParentingCategories(): string[] {
    return ['Baby', 'Books', 'Toys', 'HealthPersonalCare', 'HomeAndKitchen', 'Sports'];
  }

  /**
   * Get affiliate article topic ideas
   */
  static getAffiliateTopicIdeas(): string[] {
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
      'Top STEM Toys for Curious Kids',
    ];
  }
}

export default AmazonProductService;
