import axios, { AxiosInstance } from 'axios';

interface WordPressPost {
  title: string;
  content: string;
  excerpt?: string;
  categories?: number[];
  tags?: number[];
  status?: 'publish' | 'draft';
}

interface WordPressPostResponse {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  status: string;
  link: string;
  date: string;
  modified: string;
  categories: number[];
  tags: number[];
}

export class WordPressService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(wordpressUrl: string, username: string, password: string) {
    this.baseURL = `${wordpressUrl}/wp-json/wp/v2`;

    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createPost(post: WordPressPost): Promise<WordPressPostResponse> {
    try {
      const response = await this.client.post('/posts', {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || '',
        status: post.status || 'draft',
        categories: post.categories || [],
        tags: post.tags || []
      });

      console.log(`✓ Post created successfully with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  async updatePost(postId: number, post: Partial<WordPressPost>): Promise<WordPressPostResponse> {
    try {
      const response = await this.client.post(`/posts/${postId}`, post);
      console.log(`✓ Post ${postId} updated successfully`);
      return response.data;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  async getPost(postId: number): Promise<WordPressPostResponse> {
    try {
      const response = await this.client.get(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching post:', error);
      throw error;
    }
  }

  async listPosts(pageNumber: number = 1, perPage: number = 10): Promise<WordPressPostResponse[]> {
    try {
      const response = await this.client.get('/posts', {
        params: {
          page: pageNumber,
          per_page: perPage
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error listing posts:', error);
      throw error;
    }
  }
}
