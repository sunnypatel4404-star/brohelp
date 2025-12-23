/**
 * Image Generation Configuration
 * Style: Warm, modern parenting blog illustrations like the Co-Regulation example
 */

export type ImageType = 'wordpress' | 'pinterest';

export interface ImageGenerationConfig {
  size: '1024x1024' | '1024x1792' | '1792x1024';
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
  promptTemplate: (topic: string, articleContent?: string) => string;
}

/**
 * Get a specific illustration description for a topic
 * Each description explicitly states WHO is in the scene (parent, child, multiple children, etc.)
 */
function getIllustrationForTopic(topic: string): string {
  const lowerTopic = topic.toLowerCase();

  // Map topics to specific illustrations with EXPLICIT character descriptions
  // Order matters - more specific keywords first
  const illustrations: Array<{ keywords: string[]; illustration: string }> = [
    // PLAYDATES & SOCIAL - TWO OR MORE CHILDREN
    {
      keywords: ['playdate', 'play date', 'friend', 'friendship', 'social skill'],
      illustration: 'TWO CHILDREN sitting together on the floor, playing with toys between them. One child is handing a toy to the other child. Both children are smiling. A small heart floats between them. The children are LARGE in the frame, taking up most of the image.'
    },
    // CO-REGULATION & CALMING
    {
      keywords: ['co-regulation', 'calm down', 'regulate', 'sooth', 'comfort'],
      illustration: 'A PARENT and CHILD sitting cross-legged facing each other, holding hands gently. Both have peaceful expressions with closed eyes. A small heart floats between them. Soft clouds in the background. The figures are LARGE and centered.'
    },
    // GRATITUDE & THANKFULNESS
    {
      keywords: ['grateful', 'gratitude', 'thankful', 'thank', 'appreciation'],
      illustration: 'A CHILD hugging a PARENT warmly. Hearts floating around them. Both have happy, content expressions. The figures are LARGE and take up most of the image.'
    },
    // SLEEP & BEDTIME
    {
      keywords: ['sleep', 'bedtime', 'nap', 'night', 'dream'],
      illustration: 'A CHILD peacefully sleeping in bed, tucked under a soft blanket, hugging a teddy bear. A crescent moon and stars visible through a window. The sleeping child is LARGE and centered in the frame.'
    },
    // POTTY TRAINING
    {
      keywords: ['potty', 'toilet', 'bathroom training'],
      illustration: 'A proud TODDLER standing next to a small colorful potty chair, with arms raised in celebration. A PARENT nearby giving a thumbs up. Gold stars floating around. The figures are LARGE in the frame.'
    },
    // READING TOGETHER
    {
      keywords: ['read', 'book', 'story', 'literacy'],
      illustration: 'A PARENT and CHILD sitting close together on a couch, the parent holding an open book. The child looks engaged and happy. The figures are LARGE and take up most of the image.'
    },
    // SHARING - TWO CHILDREN
    {
      keywords: ['share', 'sharing', 'turns', 'taking turns'],
      illustration: 'TWO CHILDREN sitting together. One child is offering a toy to the other child with a smile. Hearts floating between them. Both children are LARGE in the frame.'
    },
    // EMOTIONS & FEELINGS
    {
      keywords: ['emotion', 'feeling', 'tantrum', 'meltdown', 'angry', 'sad', 'upset', 'big feeling'],
      illustration: 'A PARENT kneeling down at child level, gently holding a CHILD who looks upset. The parent has a calm, loving expression. A heart floats nearby. The figures are LARGE and centered.'
    },
    // FOOD & EATING
    {
      keywords: ['food', 'eat', 'meal', 'nutrition', 'picky', 'feeding', 'snack'],
      illustration: 'A happy CHILD sitting at a small table with a colorful plate of food - fruits, vegetables, and healthy snacks arranged nicely. The child is LARGE and centered in the frame.'
    },
    // OUTDOOR & NATURE
    {
      keywords: ['outdoor', 'outside', 'nature', 'park', 'garden'],
      illustration: 'A PARENT and CHILD walking together hand-in-hand in a sunny park. Flowers, butterflies, and trees around them. Both are smiling. The figures are LARGE in the frame.'
    },
    // SOLO PLAY
    {
      keywords: ['play', 'toy', 'game', 'imagination', 'pretend'],
      illustration: 'A CHILD happily playing with colorful blocks or toys on the floor. The child is focused and joyful. Maybe a stuffed animal nearby. The child is LARGE and centered in the frame.'
    },
    // MANNERS
    {
      keywords: ['manner', 'polite', 'please', 'etiquette'],
      illustration: 'A CHILD and ADULT facing each other. The child has hands together politely. The adult is smiling warmly. A heart or star floats between them. The figures are LARGE in the frame.'
    },
    // SIBLINGS
    {
      keywords: ['sibling', 'brother', 'sister', 'new baby'],
      illustration: 'An OLDER CHILD gently holding or hugging a BABY sibling. Hearts floating between them. Both look content. The figures are LARGE and centered.'
    },
    // DISCIPLINE & BOUNDARIES
    {
      keywords: ['discipline', 'boundary', 'rule', 'limit', 'consequence'],
      illustration: 'A PARENT and CHILD sitting at eye level, having a calm conversation. The parent has a gentle but firm expression. The child is listening. The figures are LARGE and centered.'
    },
    // HEALTH & DOCTOR
    {
      keywords: ['health', 'doctor', 'sick', 'medicine', 'checkup'],
      illustration: 'A friendly DOCTOR or PARENT with a CHILD, in a non-scary medical moment. Maybe the child holding a toy stethoscope. Both smiling. The figures are LARGE in the frame.'
    },
    // CONFIDENCE
    {
      keywords: ['confidence', 'self-esteem', 'brave', 'courage', 'proud'],
      illustration: 'A CHILD standing tall with arms raised triumphantly, like a superhero pose. Stars and sparkles around them. A PARENT watching proudly in the background. The child is LARGE and centered.'
    },
    // ROUTINE
    {
      keywords: ['routine', 'schedule', 'morning', 'habit'],
      illustration: 'A PARENT and CHILD going through a morning routine together - maybe brushing teeth or getting dressed. Both are smiling. The figures are LARGE in the frame.'
    },
    // KINDNESS - TWO CHILDREN
    {
      keywords: ['kind', 'kindness', 'compassion', 'empathy', 'gentle', 'caring'],
      illustration: 'One CHILD helping another CHILD who fell down, or giving them a hug. Hearts floating around. Both children are LARGE in the frame.'
    },
    // PATIENCE
    {
      keywords: ['patience', 'patient', 'wait', 'waiting'],
      illustration: 'A CHILD sitting calmly with hands folded, perhaps looking at a timer or waiting for cookies. A PARENT nearby. Both are calm. The figures are LARGE in the frame.'
    },
    // HONESTY
    {
      keywords: ['honest', 'honesty', 'truth', 'lying', 'trust'],
      illustration: 'A PARENT and CHILD having a heart-to-heart talk, sitting together at eye level. Both have open, sincere expressions. A heart between them. The figures are LARGE and centered.'
    },
    // INDEPENDENCE
    {
      keywords: ['independent', 'independence', 'self-care', 'themselves'],
      illustration: 'A proud CHILD doing something independently - like tying shoes or pouring cereal. A PARENT watching proudly from nearby. The child is LARGE and centered.'
    },
    // CHORES
    {
      keywords: ['chore', 'responsib', 'cleaning', 'helping', 'tidy'],
      illustration: 'A CHILD happily helping with a task - putting toys away or wiping a table. A PARENT giving encouragement. The figures are LARGE in the frame.'
    },
    // LEARNING
    {
      keywords: ['abc', 'alphabet', 'letters', 'numbers', 'counting', 'learning', 'school', 'preschool'],
      illustration: 'A PARENT and CHILD at a small table with colorful learning materials. The child looks curious and engaged. The figures are LARGE and centered.'
    },
    // COMMUNICATION
    {
      keywords: ['talk', 'communicat', 'listen', 'conversation', 'speaking'],
      illustration: 'A PARENT and CHILD sitting together, having a warm conversation. Eye contact, leaning in. Hearts or speech bubbles with hearts. The figures are LARGE in the frame.'
    },
    // ART
    {
      keywords: ['art', 'craft', 'draw', 'paint', 'creative', 'color'],
      illustration: 'A CHILD happily painting or drawing at an easel or table. Colorful artwork visible. Maybe a PARENT watching. The child is LARGE and centered.'
    },
    // SEPARATION
    {
      keywords: ['separation', 'goodbye', 'daycare', 'leaving', 'drop off'],
      illustration: 'A PARENT hugging a CHILD goodbye, with a visible heart connecting them even as they prepare to part. Both have loving expressions. The figures are LARGE and centered.'
    },
    // MINDFULNESS
    {
      keywords: ['mindful', 'meditation', 'yoga', 'breathe', 'relax', 'calm'],
      illustration: 'A PARENT and CHILD sitting peacefully cross-legged together, eyes closed, calm expressions. Soft clouds around them. A heart between them. The figures are LARGE and centered.'
    },
    // SCREEN TIME
    {
      keywords: ['screen', 'tablet', 'phone', 'tv', 'technology', 'device'],
      illustration: 'A PARENT and CHILD together, with a tablet showing a timer nearby. Books and outdoor toys visible, showing balance. The figures are LARGE in the frame.'
    },
    // TODDLER
    {
      keywords: ['toddler', 'terrible twos', 'two year', '2 year'],
      illustration: 'A cute TODDLER walking or playing, with a PARENT nearby watching lovingly. The toddler is the focus, LARGE and centered in the frame.'
    },
    // BABY
    {
      keywords: ['baby', 'infant', 'newborn', 'month old'],
      illustration: 'A PARENT gently holding a BABY, looking down with love. Hearts floating. The figures are LARGE and take up most of the image.'
    },
    // TEEN
    {
      keywords: ['teen', 'tween', 'adolescent', 'preteen', 'teenager'],
      illustration: 'A PARENT and TEENAGER sitting together, having a respectful conversation. Both are LARGE and centered in the frame.'
    },
    // NAVIGATING/GENERAL
    {
      keywords: ['navigat', 'tips', 'guide', 'how to', 'help your', 'ways to'],
      illustration: 'A PARENT and CHILD together, looking happy and connected. A heart or lightbulb symbol nearby. The figures are LARGE and centered.'
    },
  ];

  // Find matching illustration
  for (const item of illustrations) {
    if (item.keywords.some(keyword => lowerTopic.includes(keyword))) {
      return item.illustration;
    }
  }

  // Fallback - always show parent and child together
  const words = topic.split(/\s+/).filter(w => w.length > 3);
  const mainConcept = words.slice(0, 3).join(' ');
  return `A PARENT and CHILD together in a warm, loving moment related to "${mainConcept}". Both are smiling. A heart floats between them. The figures are LARGE and take up most of the image.`;
}

/**
 * The target style prompt - based on the Co-Regulation example image
 */
const STYLE_PROMPT = `
⛔️ MANDATORY: ZERO TEXT IN IMAGE ⛔️
This image must contain ZERO text, ZERO words, ZERO letters, ZERO titles, ZERO labels.
Do not write the topic. Do not add any captions. ILLUSTRATION ONLY.
Text will be added separately by software.

STYLE (MUST FOLLOW EXACTLY):
- Modern flat 2D vector illustration style
- Warm, soft pastel colors: peach/coral, mint green, soft blue, cream, light purple
- Plain warm cream/beige background - NO shapes, NO large decorative elements behind the characters
- Characters should look like CHILDREN (small, cute proportions - not adults):
  - Small bodies with slightly larger heads (child proportions)
  - Simple round faces with rosy cheeks
  - Dot eyes, simple curved smile
  - Natural skin tones
  - Simple solid-color clothing
- Background: PLAIN cream color only. Maybe 1-2 tiny soft clouds. NO large shapes or decorative elements.
- NO harsh lines or dark outlines
- Clean, minimal, uncluttered

CHARACTER PROPORTIONS:
- Children should look like YOUNG CHILDREN (ages 3-6), not adults
- Cute, small proportions - not chunky or oversized
- Characters should be the focal point but properly sized

COMPOSITION:
- Leave space at TOP of image (for title overlay added later)
- Main characters/scene positioned in the MIDDLE area
- Leave a small amount of space at the very bottom for branding

DO NOT ADD:
- No large decorative shapes behind the characters
- No busy backgrounds
- NO TEXT OF ANY KIND
`;

/**
 * Pinterest Pin Image Configuration
 */
export const pinterestImageConfig: ImageGenerationConfig = {
  size: '1024x1792',
  quality: 'hd',
  style: 'natural',

  promptTemplate: (topic: string, _articleContent?: string) => {
    const illustration = getIllustrationForTopic(topic);

    return `⛔️ CRITICAL: DO NOT ADD ANY TEXT, WORDS, OR LETTERS TO THIS IMAGE ⛔️

Create a simple illustration showing: ${illustration}

${STYLE_PROMPT}`;
  }
};

/**
 * WordPress Featured Image Configuration
 */
export const wordpressImageConfig: ImageGenerationConfig = {
  size: '1024x1792',
  quality: 'hd',
  style: 'natural',

  promptTemplate: (topic: string, _articleContent?: string) => {
    const illustration = getIllustrationForTopic(topic);

    return `⛔️ CRITICAL: DO NOT ADD ANY TEXT, WORDS, OR LETTERS TO THIS IMAGE ⛔️

Create a simple illustration showing: ${illustration}

${STYLE_PROMPT}`;
  }
};

/**
 * Get image configuration based on image type
 */
export function getImageConfig(type: ImageType): ImageGenerationConfig {
  switch (type) {
    case 'pinterest':
      return pinterestImageConfig;
    case 'wordpress':
      return wordpressImageConfig;
    default:
      return wordpressImageConfig;
  }
}

/**
 * Image type metadata
 */
export const imageTypeMetadata = {
  wordpress: {
    name: 'WordPress Featured Image',
    description: 'Portrait format optimized for blog featured images',
    aspectRatio: '2:3',
    dimensions: '1024x1792',
    useCase: 'Blog header and featured image'
  },
  pinterest: {
    name: 'Pinterest Pin',
    description: 'Vertical format optimized for Pinterest',
    aspectRatio: '2:3',
    dimensions: '1024x1792',
    useCase: 'Pinterest pin sharing and promotion'
  }
} as const;
