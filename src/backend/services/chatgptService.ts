import OpenAI from 'openai';
import { BotConfig } from '../config/botConfig';

interface ArticleRequest {
  topic: string;
  config?: BotConfig;
  includeExcerpt?: boolean;
  internalLinkingInstructions?: string;
}

interface GeneratedArticle {
  title: string;
  content: string;
  excerpt?: string;
}

// Default timeout for ChatGPT API calls (5 minutes)
const CHATGPT_TIMEOUT_MS = 5 * 60 * 1000;

export class ChatGPTService {
  private client: OpenAI;
  private config?: BotConfig;

  constructor(apiKey: string, config?: BotConfig, timeoutMs: number = CHATGPT_TIMEOUT_MS) {
    this.client = new OpenAI({
      apiKey,
      timeout: timeoutMs,
      maxRetries: 2
    });
    this.config = config;
  }

  async generateArticle(request: ArticleRequest): Promise<GeneratedArticle> {
    const {
      topic,
      config = this.config,
      includeExcerpt = true,
      internalLinkingInstructions = ''
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
${internalLinkingInstructions}

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

      // Parse the JSON response with robust error handling
      let article: GeneratedArticle;
      try {
        article = this.parseArticleResponse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response');
        console.error('Response was:', responseText.substring(0, 500));
        throw new Error('Could not parse article response: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
      }

      // Validate the parsed article has required fields
      if (!article.title || !article.content) {
        throw new Error('Parsed article is missing required fields (title or content)');
      }

      // Validate content is not truncated (should have reasonable length)
      if (article.content.length < 500) {
        console.warn('Warning: Article content seems short, may be truncated');
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

  /**
   * Robust JSON parsing for ChatGPT responses
   * Handles common issues like markdown wrappers, truncated responses, etc.
   */
  private parseArticleResponse(responseText: string): GeneratedArticle {
    // Step 1: Clean up common wrapper issues
    let cleanedText = responseText.trim();

    // Remove markdown code blocks if present
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    // Step 2: Find the JSON object boundaries
    const jsonStart = cleanedText.indexOf('{');
    if (jsonStart === -1) {
      throw new Error('No JSON object found in response');
    }

    // Find the matching closing brace by counting braces
    let braceCount = 0;
    let jsonEnd = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = jsonStart; i < cleanedText.length; i++) {
      const char = cleanedText[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }

    // Step 3: Try to parse the extracted JSON
    let jsonString: string;
    if (jsonEnd !== -1) {
      jsonString = cleanedText.substring(jsonStart, jsonEnd);
    } else {
      // If no matching brace found, try to fix truncated JSON
      jsonString = cleanedText.substring(jsonStart);
      // Try to close any unclosed structures
      jsonString = this.attemptJsonRepair(jsonString);
    }

    // Step 4: Attempt parsing
    try {
      const parsed = JSON.parse(jsonString);
      return this.validateAndCleanArticle(parsed);
    } catch {
      // Step 5: Try common fixes
      const fixes = [
        // Fix: Remove trailing comma before closing brace
        () => jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'),
        // Fix: Add missing closing brace
        () => jsonString + '}',
        // Fix: Add missing closing brace and bracket
        () => jsonString + '"}',
        // Fix: Replace single quotes with double quotes
        () => jsonString.replace(/'/g, '"'),
      ];

      for (const fix of fixes) {
        try {
          const fixedJson = fix();
          const parsed = JSON.parse(fixedJson);
          return this.validateAndCleanArticle(parsed);
        } catch {
          continue;
        }
      }

      // Step 6: Last resort - regex extraction
      return this.extractArticleViaRegex(responseText);
    }
  }

  /**
   * Attempt to repair truncated JSON
   */
  private attemptJsonRepair(jsonString: string): string {
    // Count unclosed braces and brackets
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escapeNext = false;

    for (const char of jsonString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '[') brackets++;
        if (char === ']') brackets--;
      }
    }

    // If we're in a string, close it
    if (inString) {
      jsonString += '"';
    }

    // Close unclosed brackets and braces
    while (brackets > 0) {
      jsonString += ']';
      brackets--;
    }
    while (braces > 0) {
      jsonString += '}';
      braces--;
    }

    return jsonString;
  }

  /**
   * Validate and clean the parsed article object
   */
  private validateAndCleanArticle(parsed: unknown): GeneratedArticle {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Parsed response is not an object');
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.title !== 'string') {
      throw new Error('Missing or invalid title field');
    }

    if (typeof obj.content !== 'string') {
      throw new Error('Missing or invalid content field');
    }

    return {
      title: obj.title.trim(),
      content: obj.content.trim(),
      excerpt: typeof obj.excerpt === 'string' ? obj.excerpt.trim() : undefined
    };
  }

  /**
   * Last resort: extract article fields via regex
   * This handles severely malformed responses
   */
  private extractArticleViaRegex(responseText: string): GeneratedArticle {
    // Match title - capture everything between "title": " and the next unescaped quote
    const titleMatch = responseText.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);

    // Match content - this is trickier because content can be very long
    // Look for "content": " and capture until we find the pattern for the next field or end
    const contentStartMatch = responseText.match(/"content"\s*:\s*"/);

    if (!titleMatch || !contentStartMatch) {
      throw new Error('Could not extract title and content via regex');
    }

    const title = titleMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');

    // Find content boundaries
    const contentStart = contentStartMatch.index! + contentStartMatch[0].length;
    let contentEnd = responseText.length;

    // Look for the end of content (either "excerpt": or end of object)
    const excerptMatch = responseText.substring(contentStart).match(/",\s*"excerpt"\s*:/);
    const endMatch = responseText.substring(contentStart).match(/"\s*}/);

    if (excerptMatch) {
      contentEnd = contentStart + excerptMatch.index!;
    } else if (endMatch) {
      contentEnd = contentStart + endMatch.index!;
    }

    let content = responseText.substring(contentStart, contentEnd);

    // Unescape the content
    content = content
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');

    // Try to extract excerpt if present
    let excerpt: string | undefined;
    const excerptFullMatch = responseText.match(/"excerpt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (excerptFullMatch) {
      excerpt = excerptFullMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\\\/g, '\\');
    }

    console.warn('Warning: Used regex fallback for JSON parsing - result may be incomplete');

    return {
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt?.trim()
    };
  }
}
