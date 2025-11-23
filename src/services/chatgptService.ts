import OpenAI from 'openai';
import { BotConfig } from '../config/botConfig';

interface ArticleRequest {
  topic: string;
  config?: BotConfig;
  includeExcerpt?: boolean;
}

interface GeneratedArticle {
  title: string;
  content: string;
  excerpt?: string;
}

export class ChatGPTService {
  private client: OpenAI;
  private config?: BotConfig;

  constructor(apiKey: string, config?: BotConfig) {
    this.client = new OpenAI({ apiKey });
    this.config = config;
  }

  async generateArticle(request: ArticleRequest): Promise<GeneratedArticle> {
    const {
      topic,
      config = this.config,
      includeExcerpt = true
    } = request;

    if (!config) {
      throw new Error('Bot configuration is required');
    }

    const userPrompt = `${config.systemPrompt}

Generate a comprehensive blog article about: "${topic}"

Requirements:
- Approximate word count: ${config.wordCountMin}-${config.wordCountMax} words
- Tone: ${config.tone}
- Include these content elements: ${config.contentTypes.join(', ')}
- Include relevant emoji in title
- Age-segment advice when applicable
- Include 2-3 "💛 Mom Tip" sections
- Format the response as JSON with the following structure:
{
  "title": "Emoji Article Title Here",
  "content": "Full HTML-formatted article content here with proper h2/h3 tags...",
  ${includeExcerpt ? '"excerpt": "A brief 1-2 sentence excerpt here..."' : ''}
}

Remember to:
- Use warm, conversational language
- Include specific examples, product names, or book titles
- End with aspirational language and a Key Takeaway section
- Make it feel like advice from a knowledgeable friend
- Keep paragraphs short (2-4 sentences max)`;

    try {
      const message = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      const responseText = message.choices[0].message.content || '';

      // Parse the JSON response - find the JSON object
      let article: GeneratedArticle;
      try {
        // Try to find and parse JSON
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');

        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('No JSON object found in response');
        }

        const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
        article = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse JSON response');
        console.error('Response was:', responseText.substring(0, 500));
        throw new Error('Could not parse article response: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
      }

      console.log(`✓ Article generated: "${article.title}"`);

      return article;
    } catch (error) {
      console.error('Error generating article:', error);
      throw error;
    }
  }

  async generateMultipleArticles(
    topics: string[],
    options: Partial<ArticleRequest> = {}
  ): Promise<GeneratedArticle[]> {
    const articles: GeneratedArticle[] = [];

    for (const topic of topics) {
      const article = await this.generateArticle({
        topic,
        ...options
      });
      articles.push(article);

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return articles;
  }
}
