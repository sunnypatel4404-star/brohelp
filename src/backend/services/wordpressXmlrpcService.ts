import axios, { AxiosError } from 'axios';
import * as fs from 'fs';

// Marker class for base64 data - WordPress XML-RPC requires <base64> tags, not <string>
class Base64Data {
  constructor(public readonly data: string) {}
}

interface WordPressPost {
  title: string;
  content: string;
  excerpt?: string;
  categories?: number[];
  tags?: number[];
  tagNames?: string[];  // Tag names as strings (will be created if they don't exist)
  status?: 'publish' | 'draft';
}

interface WordPressPostData {
  post_title: string;
  post_content: string;
  post_excerpt: string;
  post_status: string;
  post_type: string;
  terms_category?: number[];
  terms_post_tag?: number[];
  terms_names?: { post_tag: string[] };
}

interface WordPressPostResult {
  id: number;
  title?: string;
}

export class WordPressXmlRpcService {
  private xmlrpcUrl: string;
  private username: string;
  private password: string;
  private blogId: number;

  constructor(
    wordpressUrl: string,
    username: string,
    password: string,
    blogId: number = 1
  ) {
    // Convert domain to WordPress.com XML-RPC URL
    // e.g., https://parentvillage.blog -> https://parentvillage.blog/xmlrpc.php
    this.xmlrpcUrl = `${wordpressUrl.replace(/\/$/, '')}/xmlrpc.php`;
    this.username = username;
    this.password = password;
    this.blogId = blogId;
  }

  /**
   * Sanitize error for logging - removes any potential credential exposure
   * Axios errors can contain request config with the full XML body including credentials
   */
  private sanitizeError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || 'unknown';
      const statusText = axiosError.response?.statusText || '';
      const url = axiosError.config?.url ? new URL(axiosError.config.url).hostname : 'unknown';
      return `HTTP ${status} ${statusText} from ${url}: ${axiosError.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    // For non-Error objects, convert to string but limit length
    const str = String(error);
    return str.length > 200 ? str.substring(0, 200) + '...' : str;
  }

  /**
   * Build XML-RPC request
   */
  private buildXmlRpcRequest(
    methodName: string,
    params: (string | number | object)[]
  ): string {
    const paramXml = params
      .map(param => this.valueToXml(param))
      .join('');

    return `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramXml}
  </params>
</methodCall>`;
  }

  /**
   * Convert value to XML-RPC format
   */
  private valueToXml(value: string | number | object): string {
    if (typeof value === 'string') {
      return `<param><value><string>${this.escapeXml(value)}</string></value></param>`;
    } else if (typeof value === 'number') {
      return `<param><value><int>${value}</int></value></param>`;
    } else if (typeof value === 'object') {
      return `<param><value>${this.structToXml(value)}</value></param>`;
    }
    return '';
  }

  /**
   * Convert object/struct to XML-RPC format
   */
  private structToXml(obj: object): string {
    const members = Object.entries(obj)
      .map(
        ([key, value]) => `
    <member>
      <name>${this.escapeXml(key)}</name>
      <value>${this.valueToXmlContent(value)}</value>
    </member>`
      )
      .join('');

    return `<struct>${members}</struct>`;
  }

  /**
   * Get value as XML-RPC content (without wrapping <param>)
   */
  private valueToXmlContent(
    value: string | number | object | undefined
  ): string {
    if (value === undefined || value === null) {
      return '<string></string>';
    }
    // Handle Base64Data specially - WordPress XML-RPC requires <base64> tags for binary data
    if (value instanceof Base64Data) {
      return `<base64>${value.data}</base64>`;
    }
    if (typeof value === 'string') {
      return `<string>${this.escapeXml(value)}</string>`;
    } else if (typeof value === 'number') {
      return `<int>${value}</int>`;
    } else if (typeof value === 'boolean') {
      return `<boolean>${value ? '1' : '0'}</boolean>`;
    } else if (typeof value === 'object' && Array.isArray(value)) {
      const arrayItems = value
        .map(item => `<value>${this.valueToXmlContent(item)}</value>`)
        .join('');
      return `<array><data>${arrayItems}</data></array>`;
    } else if (typeof value === 'object') {
      return this.structToXml(value);
    }
    return '<string></string>';
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse XML-RPC response with full support for structs, arrays, and nested values
   */
  private parseXmlRpcResponse(responseText: string): unknown {
    // Check for fault first
    if (responseText.includes('<fault>')) {
      const faultStringMatch = responseText.match(
        /<name>faultString<\/name>\s*<value>(?:<string>)?([^<]*)(?:<\/string>)?<\/value>/
      );
      const faultCodeMatch = responseText.match(
        /<name>faultCode<\/name>\s*<value>(?:<int>)?(\d+)(?:<\/int>)?<\/value>/
      );
      const faultString = faultStringMatch ? faultStringMatch[1] : 'Unknown error';
      const faultCode = faultCodeMatch ? faultCodeMatch[1] : 'unknown';
      throw new Error(`WordPress XML-RPC Error (${faultCode}): ${faultString}`);
    }

    // Find the params section
    const paramsMatch = responseText.match(/<params>\s*<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>\s*<\/params>/);
    if (!paramsMatch) {
      // Try to find a simple value response
      return this.parseXmlValue(responseText);
    }

    return this.parseXmlValue(paramsMatch[1]);
  }

  /**
   * Parse a single XML-RPC value element
   */
  private parseXmlValue(xml: string): unknown {
    const trimmed = xml.trim();

    // String (with or without <string> tags - XML-RPC allows bare strings)
    const stringMatch = trimmed.match(/^<string>([\s\S]*?)<\/string>$/);
    if (stringMatch) return this.unescapeXml(stringMatch[1]);

    // Integer
    const intMatch = trimmed.match(/^<int>(-?\d+)<\/int>$/) || trimmed.match(/^<i4>(-?\d+)<\/i4>$/);
    if (intMatch) return parseInt(intMatch[1], 10);

    // Double
    const doubleMatch = trimmed.match(/^<double>(-?[\d.]+)<\/double>$/);
    if (doubleMatch) return parseFloat(doubleMatch[1]);

    // Boolean
    const boolMatch = trimmed.match(/^<boolean>([01])<\/boolean>$/);
    if (boolMatch) return boolMatch[1] === '1';

    // Base64
    const base64Match = trimmed.match(/^<base64>([\s\S]*?)<\/base64>$/);
    if (base64Match) return base64Match[1];

    // DateTime
    const dateMatch = trimmed.match(/^<dateTime\.iso8601>([^<]+)<\/dateTime\.iso8601>$/);
    if (dateMatch) return dateMatch[1];

    // Nil/null
    if (trimmed.match(/^<nil\s*\/>$/)) return null;

    // Array
    const arrayMatch = trimmed.match(/^<array>\s*<data>([\s\S]*?)<\/data>\s*<\/array>$/);
    if (arrayMatch) {
      return this.parseXmlArray(arrayMatch[1]);
    }

    // Struct
    const structMatch = trimmed.match(/^<struct>([\s\S]*?)<\/struct>$/);
    if (structMatch) {
      return this.parseXmlStruct(structMatch[1]);
    }

    // If no type wrapper, treat as string (XML-RPC spec allows this)
    if (!trimmed.startsWith('<')) {
      return this.unescapeXml(trimmed);
    }

    // Fallback: try to extract any recognizable value
    const fallbackInt = trimmed.match(/<int>(-?\d+)<\/int>/);
    if (fallbackInt) return parseInt(fallbackInt[1], 10);

    const fallbackString = trimmed.match(/<string>([\s\S]*?)<\/string>/);
    if (fallbackString) return this.unescapeXml(fallbackString[1]);

    return null;
  }

  /**
   * Parse XML-RPC array data
   */
  private parseXmlArray(dataContent: string): unknown[] {
    const result: unknown[] = [];
    const valueRegex = /<value>([\s\S]*?)<\/value>/g;
    let match;

    while ((match = valueRegex.exec(dataContent)) !== null) {
      result.push(this.parseXmlValue(match[1]));
    }

    return result;
  }

  /**
   * Parse XML-RPC struct
   */
  private parseXmlStruct(structContent: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const memberRegex = /<member>\s*<name>([^<]+)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
    let match;

    while ((match = memberRegex.exec(structContent)) !== null) {
      const name = this.unescapeXml(match[1]);
      result[name] = this.parseXmlValue(match[2]);
    }

    return result;
  }

  /**
   * Unescape XML entities
   */
  private unescapeXml(str: string): string {
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  /**
   * Create a post via XML-RPC
   */
  async createPost(post: WordPressPost): Promise<WordPressPostResult> {
    try {
      const postData: WordPressPostData = {
        post_title: post.title,
        post_content: post.content,
        post_excerpt: post.excerpt || '',
        post_status: post.status || 'draft',
        post_type: 'post'
      };

      if (post.categories && post.categories.length > 0) {
        postData.terms_category = post.categories;
      }

      // Support both tag IDs and tag names
      if (post.tags && post.tags.length > 0) {
        postData.terms_post_tag = post.tags;
      }

      // Use terms_names for string tag names (WordPress will create tags if they don't exist)
      if (post.tagNames && post.tagNames.length > 0) {
        // Clean tag names: remove # prefix, trim whitespace
        const cleanedTags = post.tagNames
          .map(tag => tag.replace(/^#/, '').trim())
          .filter(tag => tag.length > 0);

        if (cleanedTags.length > 0) {
          postData.terms_names = {
            post_tag: cleanedTags
          };
        }
      }

      const xmlRequest = this.buildXmlRpcRequest('wp.newPost', [
        this.blogId,
        this.username,
        this.password,
        postData
      ]);

      const response = await axios.post(this.xmlrpcUrl, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      const postIdResult = this.parseXmlRpcResponse(response.data);
      const postId = typeof postIdResult === 'number' ? postIdResult : Number(postIdResult);

      if (!postId || isNaN(postId)) {
        throw new Error('Failed to get post ID from response');
      }

      console.log(`✓ Post created successfully with ID: ${postId}`);

      return { id: postId, title: post.title };
    } catch (error) {
      console.error('Error creating post:', this.sanitizeError(error));
      throw error;
    }
  }

  /**
   * Update a post via XML-RPC
   */
  async updatePost(
    postId: number,
    post: Partial<WordPressPost>
  ): Promise<WordPressPostResult> {
    try {
      const postData: Partial<WordPressPostData> = {};

      if (post.title) postData.post_title = post.title;
      if (post.content) postData.post_content = post.content;
      if (post.excerpt) postData.post_excerpt = post.excerpt;
      if (post.status) postData.post_status = post.status;

      const xmlRequest = this.buildXmlRpcRequest('wp.editPost', [
        this.blogId,
        this.username,
        this.password,
        postId,
        postData
      ]);

      await axios.post(this.xmlrpcUrl, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      console.log(`✓ Post ${postId} updated successfully`);

      return { id: postId };
    } catch (error) {
      console.error('Error updating post:', this.sanitizeError(error));
      throw error;
    }
  }

  /**
   * Get a post via XML-RPC
   */
  async getPost(postId: number): Promise<unknown> {
    try {
      const xmlRequest = this.buildXmlRpcRequest('wp.getPost', [
        this.blogId,
        this.username,
        this.password,
        postId
      ]);

      const response = await axios.post(this.xmlrpcUrl, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      // Parse the response (simplified)
      return response.data;
    } catch (error) {
      console.error('Error fetching post:', this.sanitizeError(error));
      throw error;
    }
  }

  /**
   * Upload media via XML-RPC and return attachment info including URL
   */
  async uploadMedia(
    imagePath: string,
    fileName: string,
    mimeType: string = 'image/png'
  ): Promise<{ attachmentId: number; url: string }> {
    try {
      const imageData = fs.readFileSync(imagePath);
      const base64Data = imageData.toString('base64');

      // Use Base64Data wrapper so XML builder uses <base64> tags instead of <string>
      const mediaData = {
        name: fileName,
        type: mimeType,
        bits: new Base64Data(base64Data),
        overwrite: false
      };

      const xmlRequest = this.buildXmlRpcRequest('wp.uploadFile', [
        this.blogId,
        this.username,
        this.password,
        mediaData
      ]);

      const response = await axios.post(this.xmlrpcUrl, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      // Parse response to get file info
      // WordPress returns: attachment_id, url, file, type
      const responseData = response.data as string;

      // Extract attachment ID
      let attachmentId: number | null = null;
      let idMatch = responseData.match(/<name>attachment_id<\/name>\s*<value><string>(\d+)<\/string><\/value>/);
      if (idMatch) {
        attachmentId = parseInt(idMatch[1], 10);
      } else {
        idMatch = responseData.match(/<name>id<\/name>\s*<value><int>(\d+)<\/int><\/value>/);
        if (idMatch) {
          attachmentId = parseInt(idMatch[1], 10);
        }
      }

      // Extract URL
      let url: string | null = null;
      const urlMatch = responseData.match(/<name>url<\/name>\s*<value><string>([^<]+)<\/string><\/value>/);
      if (urlMatch) {
        url = urlMatch[1];
      }

      if (!attachmentId) {
        console.warn('Could not parse attachment ID from response. Response preview:');
        console.warn(responseData.substring(0, 500));
        throw new Error('Could not extract attachment ID from upload response');
      }

      console.log(`✓ Media uploaded successfully with attachment ID: ${attachmentId}`);
      if (url) {
        console.log(`  URL: ${url}`);
      }

      return {
        attachmentId,
        url: url || ''
      };
    } catch (error) {
      console.error('Error uploading media:', this.sanitizeError(error));
      throw error;
    }
  }

  /**
   * Set featured image for a post
   */
  async setFeaturedImage(postId: number, attachmentId: number): Promise<void> {
    try {
      // WordPress.com uses 'post_thumbnail' for the featured image
      const postData = {
        post_thumbnail: attachmentId
      };

      const xmlRequest = this.buildXmlRpcRequest('wp.editPost', [
        this.blogId,
        this.username,
        this.password,
        postId,
        postData
      ]);

      const response = await axios.post(this.xmlrpcUrl, xmlRequest, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      // Check if WordPress returned success
      const result = this.parseXmlRpcResponse(response.data);
      if (result === true || result === 1) {
        console.log(`✓ Featured image set successfully for post ${postId}`);
      } else {
        console.warn(`⚠️ Featured image may not have been set. Response: ${result}`);
      }
    } catch (error) {
      console.error('Error setting featured image:', this.sanitizeError(error));
      throw error;
    }
  }
}
