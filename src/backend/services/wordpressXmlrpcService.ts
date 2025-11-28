import axios from 'axios';

interface WordPressPost {
  title: string;
  content: string;
  excerpt?: string;
  categories?: number[];
  tags?: number[];
  status?: 'publish' | 'draft';
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
    if (typeof value === 'string') {
      return `<string>${this.escapeXml(value)}</string>`;
    } else if (typeof value === 'number') {
      return `<int>${value}</int>`;
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
   * Parse XML-RPC response
   */
  private parseXmlRpcResponse(responseText: string): any {
    // Simple XML-RPC response parser for common cases
    // Look for string values
    const stringMatch = responseText.match(
      /<string[^>]*>([^<]*)<\/string>/
    );
    if (stringMatch) return stringMatch[1];

    // Look for int values
    const intMatch = responseText.match(/<int>([^<]*)<\/int>/);
    if (intMatch) return parseInt(intMatch[1], 10);

    // Look for boolean values
    const boolMatch = responseText.match(
      /<boolean>([^<]*)<\/boolean>/
    );
    if (boolMatch) return boolMatch[1] === '1';

    // Check for fault
    if (responseText.includes('<methodResponse>')) {
      const faultMatch = responseText.match(
        /<name>faultString<\/name>\s*<value><string>([^<]*)<\/string><\/value>/
      );
      if (faultMatch) {
        throw new Error(`WordPress XML-RPC Error: ${faultMatch[1]}`);
      }
    }

    return null;
  }

  /**
   * Create a post via XML-RPC
   */
  async createPost(post: WordPressPost): Promise<any> {
    try {
      const postData = {
        post_title: post.title,
        post_content: post.content,
        post_excerpt: post.excerpt || '',
        post_status: post.status || 'draft',
        post_type: 'post'
      };

      if (post.categories && post.categories.length > 0) {
        (postData as any).terms_category = post.categories;
      }

      if (post.tags && post.tags.length > 0) {
        (postData as any).terms_post_tag = post.tags;
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

      const postId = this.parseXmlRpcResponse(response.data);

      if (!postId || isNaN(postId)) {
        throw new Error('Failed to get post ID from response');
      }

      console.log(`✓ Post created successfully with ID: ${postId}`);

      return { id: postId, title: post.title };
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  /**
   * Update a post via XML-RPC
   */
  async updatePost(
    postId: number,
    post: Partial<WordPressPost>
  ): Promise<any> {
    try {
      const postData: any = {};

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
      console.error('Error updating post:', error);
      throw error;
    }
  }

  /**
   * Get a post via XML-RPC
   */
  async getPost(postId: number): Promise<any> {
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
      console.error('Error fetching post:', error);
      throw error;
    }
  }

  /**
   * Upload media via XML-RPC and return attachment ID
   */
  async uploadMedia(
    imagePath: string,
    fileName: string,
    mimeType: string = 'image/png'
  ): Promise<number> {
    try {
      const fs = require('fs');
      const imageData = fs.readFileSync(imagePath);
      const base64Data = imageData.toString('base64');

      const mediaData = {
        name: fileName,
        type: mimeType,
        bits: base64Data,
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

      // Parse response to get file info - WordPress returns attachment_id as string
      // The response structure is: <struct><member><name>attachment_id</name><value><string>123</string></value></member>...</struct>
      let idMatch = response.data.match(/<name>attachment_id<\/name>\s*<value><string>(\d+)<\/string><\/value>/);
      if (idMatch) {
        const attachmentId = parseInt(idMatch[1], 10);
        console.log(`✓ Media uploaded successfully with attachment ID: ${attachmentId}`);
        return attachmentId;
      }

      // Fallback: try parsing as int
      idMatch = response.data.match(/<name>id<\/name>\s*<value><int>(\d+)<\/int><\/value>/);
      if (idMatch) {
        const attachmentId = parseInt(idMatch[1], 10);
        console.log(`✓ Media uploaded successfully with attachment ID: ${attachmentId}`);
        return attachmentId;
      }

      // If parsing fails, log response for debugging
      console.warn('Could not parse attachment ID from response. Response preview:');
      console.warn(response.data.substring(0, 500));

      throw new Error('Could not extract attachment ID from upload response');
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  }

  /**
   * Set featured image for a post
   */
  async setFeaturedImage(postId: number, attachmentId: number): Promise<void> {
    try {
      const postData = {
        _thumbnail_id: attachmentId
      };

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

      console.log(`✓ Featured image set successfully for post ${postId}`);
    } catch (error) {
      console.error('Error setting featured image:', error);
      throw error;
    }
  }
}
