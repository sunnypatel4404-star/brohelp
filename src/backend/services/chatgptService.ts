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
- Return ONLY valid JSON (no markdown, no extra text before/after)
- Ensure all quotes in content are properly escaped with backslashes
- Format the response as JSON with the following structure:
{
  "title": "Emoji Article Title Here",
  "content": "Full HTML-formatted article content here with proper h2/h3 tags and escaped quotes...",
  ${includeExcerpt ? '"excerpt": "A brief 1-2 sentence excerpt here..."' : ''}
}

Remember to:
- Use warm, conversational language
- Include specific examples, product names, or book titles
- End with aspirational language and a Key Takeaway section
- Make it feel like advice from a knowledgeable friend
- Keep paragraphs short (2-4 sentences max)
- IMPORTANT: Ensure the JSON response is valid by escaping all special characters`;

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
        // Try to find and parse JSON - look for valid JSON by trying to extract from markers
        const jsonStart = responseText.indexOf('{');

        if (jsonStart === -1) {
          throw new Error('No JSON object found in response');
        }

        // Try parsing with increasing substring lengths to handle unterminated strings
        let parsedArticle: GeneratedArticle | null = null;

        // Try from JSON start to the end first
        for (let endPos = responseText.length; endPos > jsonStart + 10; endPos--) {
          try {
            const jsonString = responseText.substring(jsonStart, endPos);
            parsedArticle = JSON.parse(jsonString);
            break;
          } catch (e) {
            // Try with 100 chars less
            continue;
          }
        }

        if (!parsedArticle) {
          // If normal parsing failed, try to manually extract title and content
          const titleMatch = responseText.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
          const contentMatch = responseText.match(/"content"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/s);

          if (titleMatch && contentMatch) {
            parsedArticle = {
              title: titleMatch[1].replace(/\\"/g, '"'),
              content: contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
              excerpt: ''
            };
          } else {
            throw new Error('Could not extract title and content from response');
          }
        }

        article = parsedArticle;
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
