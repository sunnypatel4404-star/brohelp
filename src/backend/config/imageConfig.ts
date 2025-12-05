/**
 * Image Generation Configuration
 * Defines separate parameters for WordPress featured images and Pinterest pin images
 */

export type ImageType = 'wordpress' | 'pinterest';

export interface ImageGenerationConfig {
  size: '1024x1024' | '1024x1792' | '1792x1024';
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
  promptTemplate: (topic: string) => string;
}

/**
 * Generate a specific visual scene description based on the topic
 * This translates abstract topics into concrete visual descriptions
 * Exported for potential future use in advanced prompt generation
 */
export function generateSceneForTopic(topic: string): string {
  const lowerTopic = topic.toLowerCase();

  // Keyword-based scene mapping for common parenting topics
  const sceneMap: Array<{ keywords: string[]; scene: string }> = [
    // Sharing
    {
      keywords: ['share', 'sharing'],
      scene: 'Two small children\'s hands - one giving and one receiving a colorful toy. Show the moment of exchange with a teddy bear or wooden toy being passed between the hands. Hearts or sparkles around the exchange to emphasize kindness.'
    },
    // Food/Snacks/Eating
    {
      keywords: ['snack', 'food', 'eat', 'meal', 'lunch', 'breakfast', 'dinner', 'nutrition', 'feeding'],
      scene: 'A cheerful arrangement of healthy kid-friendly foods: apple slices with cute faces, carrot sticks, grapes, cheese cubes, and crackers arranged on a pastel plate. A small juice box and napkin nearby. Everything looks appetizing and fun.'
    },
    // Reading/Books
    {
      keywords: ['read', 'book', 'story', 'stories', 'literacy'],
      scene: 'An open illustrated children\'s book with colorful pages visible, surrounded by a cozy reading setup: a soft blanket, a stuffed bunny, and a warm cup. Magical sparkles coming from the book pages.'
    },
    // Sleep/Bedtime
    {
      keywords: ['sleep', 'bed', 'bedtime', 'nap', 'night', 'dream'],
      scene: 'A cozy bed scene with fluffy pillows, a soft blanket, and a teddy bear tucked in. A crescent moon and stars visible through a window. A nightlight glowing softly. Everything suggests peaceful sleep.'
    },
    // Potty Training
    {
      keywords: ['potty', 'toilet', 'bathroom', 'training'],
      scene: 'A cute child-sized potty chair in pastel colors with a small step stool nearby. Toilet paper roll with a bow, hand soap, and a cheerful star chart on the wall showing progress. Encouraging and non-scary.'
    },
    // Learning/Education
    {
      keywords: ['learn', 'abc', 'alphabet', 'numbers', 'count', 'teach', 'education', 'school'],
      scene: 'Colorful wooden alphabet blocks spelling out ABC, with crayons, a small chalkboard, and educational toys scattered around. A child\'s drawing and gold star stickers visible.'
    },
    // Play/Toys
    {
      keywords: ['play', 'toy', 'game', 'fun'],
      scene: 'A delightful arrangement of classic toys: wooden blocks, a spinning top, stuffed animals, a toy train, and colorful balls. Everything arranged playfully with movement suggested.'
    },
    // Emotions/Feelings
    {
      keywords: ['emotion', 'feeling', 'happy', 'sad', 'angry', 'tantrum', 'calm'],
      scene: 'A collection of emoji-like faces showing different emotions (happy, sad, surprised, calm) arranged in a circle. Soft clouds and hearts around them. Gentle and approachable.'
    },
    // Safety
    {
      keywords: ['safe', 'safety', 'protect', 'childproof'],
      scene: 'A cozy protected space with safety elements: outlet covers, cabinet locks, soft corner protectors, and a baby gate. A happy house with a protective shield around it.'
    },
    // Health/Wellness
    {
      keywords: ['health', 'doctor', 'sick', 'medicine', 'wellness', 'vaccine'],
      scene: 'A friendly medical kit with a toy stethoscope, bandaids with fun patterns, a thermometer, and a teddy bear patient. Non-scary, comforting medical scene.'
    },
    // Outdoor/Nature
    {
      keywords: ['outdoor', 'outside', 'nature', 'park', 'garden', 'walk'],
      scene: 'A sunny park scene with a swing, sandbox, flowers, butterflies, and a picnic blanket. Trees, birds, and fluffy clouds in a welcoming outdoor setting.'
    },
    // Manners/Behavior
    {
      keywords: ['manner', 'polite', 'thank', 'please', 'behavior', 'kind'],
      scene: 'Two small figures bowing or waving kindly to each other with speech bubbles showing "Thank You" and "Please". Hearts floating around them. Warm and friendly interaction.'
    },
    // Screen Time/Technology
    {
      keywords: ['screen', 'tablet', 'phone', 'tv', 'technology', 'digital', 'video'],
      scene: 'A tablet device showing colorful educational content, with a timer nearby and a clock. Balance shown with books and toys next to the device. Healthy tech usage.'
    },
    // Siblings
    {
      keywords: ['sibling', 'brother', 'sister', 'baby', 'newborn', 'new baby'],
      scene: 'Two pairs of small shoes side by side - one bigger, one tiny baby shoe. A baby onesie and a big kid shirt together. Hearts connecting them. Sweet sibling connection.'
    },
    // Discipline/Boundaries
    {
      keywords: ['discipline', 'boundary', 'rule', 'timeout', 'consequence'],
      scene: 'A visual checklist with checkmarks and stars, a calm corner with a soft cushion, and a visual timer. Structured but gentle approach to boundaries.'
    },
    // Mindfulness/Meditation/Calm
    {
      keywords: ['mindful', 'meditation', 'meditate', 'calm', 'peace', 'yoga', 'breathe', 'breathing', 'relax'],
      scene: 'A peaceful scene with a child sitting cross-legged in a calm pose. Soft clouds, gentle stars, maybe a small plant nearby. Bubbles or soft circles floating around suggesting peaceful breathing. Everything very calm and centered.'
    },
    // Crying/Soothing Baby
    {
      keywords: ['cry', 'crying', 'sooth', 'soothe', 'comfort', 'fussy', 'upset'],
      scene: 'Gentle hands cradling a small baby, with soft blanket, pacifier, and gentle rocking motion suggested. Hearts and soft musical notes. Warm, comforting, nurturing scene.'
    },
    // Responsibility/Chores
    {
      keywords: ['responsib', 'chore', 'task', 'help', 'cleaning'],
      scene: 'Child-sized cleaning tools arranged nicely: small broom, toy dustpan, spray bottle with flowers, small watering can. A simple chore chart with stars. Everything looks fun and manageable for kids.'
    },
    // Biting
    {
      keywords: ['bite', 'biting'],
      scene: 'A gentle "no biting" visual with a teething toy, a soft mouth illustration showing kind words coming out instead. Hearts and gentle reminders. Non-scary, educational approach.'
    },
    // Warmth/Cold Weather
    {
      keywords: ['warm', 'cold', 'winter', 'coat', 'jacket'],
      scene: 'Cozy winter items arranged sweetly: a soft scarf, mittens, warm hat, maybe boots. Snowflakes and warm cocoa mug. Everything feels snug and comfortable.'
    },
    // Bedtime/Sleep Routines
    {
      keywords: ['routine', 'schedule', 'habit'],
      scene: 'A sweet daily routine chart with simple icons: sun for morning, plate for meals, moon for bedtime. Clock faces, stars for completed tasks. Visual and friendly.'
    },
    // ABCs/Letters/Learning
    {
      keywords: ['letter', 'writing', 'handwriting'],
      scene: 'Colorful alphabet cards, crayons, a small notebook with big letters. Maybe magnetic letters on a board. Fun and educational without being overwhelming.'
    },
    // Money/Allowance
    {
      keywords: ['money', 'allowance', 'coin', 'save', 'saving'],
      scene: 'A cute piggy bank with some coins, a small jar with money, maybe a simple chart showing saving progress. Teaching financial concepts in a kid-friendly way.'
    },
    // Curfew/Rules
    {
      keywords: ['curfew', 'bedtime', 'schedule'],
      scene: 'A friendly clock showing bedtime, moon and stars, maybe a simple calendar. Visual representation of time and routines that kids can understand.'
    },
    // Confidence/Self-esteem
    {
      keywords: ['confidence', 'self-esteem', 'brave', 'courage'],
      scene: 'A child standing tall with arms up in victory pose. Hearts, stars, and encouraging symbols around them. A mirror showing positive reflection. Everything radiates positivity and strength.'
    },
    // Kindness/Compassion
    {
      keywords: ['kind', 'kindness', 'compassion', 'caring', 'empathy'],
      scene: 'Two children helping each other - one offering a hand to help the other up. Hearts floating between them. Friendly animals nearby. Warm, caring, gentle scene.'
    },
    // Friendship
    {
      keywords: ['friend', 'friendship', 'social'],
      scene: 'Two or three children holding hands or playing together happily. Hearts, smiles, shared toys. Everything shows connection and joy.'
    },
    // Anger/Emotions Management
    {
      keywords: ['anger', 'mad', 'frustrated', 'emotion control'],
      scene: 'A calm down corner with soft cushions, a breathing visual (like bubbles), emotion faces chart. Peaceful tools for managing big feelings.'
    },
    // Homework/Learning
    {
      keywords: ['homework', 'study', 'learning'],
      scene: 'A desk with colorful books, pencils, notebook, maybe a small lamp. Stars for achievements. Everything looks organized and encouraging.'
    },
    // Gratitude/Thankfulness
    {
      keywords: ['gratitude', 'grateful', 'thankful', 'appreciation'],
      scene: 'A gratitude jar with colorful notes, hearts around it. Maybe flowers or things to be thankful for arranged beautifully. Warm and appreciative feeling.'
    }
  ];

  // Find matching scene based on keywords
  for (const mapping of sceneMap) {
    if (mapping.keywords.some(keyword => lowerTopic.includes(keyword))) {
      return mapping.scene;
    }
  }

  // Default fallback for unmatched topics - create a generic but descriptive scene
  return `A warm, inviting illustration that clearly represents "${topic}". Show the key objects, actions, or concepts associated with this topic in a way that any parent would immediately recognize. Make it obvious what the image is about through visual storytelling.`;
}

/**
 * ParentVillage Pastel Pinterest Style Configuration
 *
 * STYLE REQUIREMENTS:
 * - Flat illustration style (no gradients, no photorealism, no harsh shadows)
 * - Soft pastel color palette (gentle pinks, baby blues, mint, lavender, peach, cream, butter yellow)
 * - Rounded, friendly character design (children's book aesthetic)
 * - Minimal shading, minimal texture
 * - Clean bright background with lots of negative space
 * - Soft, low-contrast line art (brown or muted purple preferred)
 * - Pinterest vertical format (2:3 aspect ratio)
 * - Large, clean title text at the top in rounded or playful font
 * - Main illustration in the center
 * - Small branding text "ParentVillage.blog" at the bottom
 *
 * Overall vibe: warm, cheerful, mom-friendly, gentle, pastel, modern, minimalist, inviting
 */

/**
 * Pinterest Pin Image Configuration
 * Optimized for Pinterest 2:3 aspect ratio (1024x1792)
 */
export const pinterestImageConfig: ImageGenerationConfig = {
  size: '1024x1792', // Will be resized to 1024x1536 (2:3 standard Pinterest)
  quality: 'hd',
  style: 'natural',

  promptTemplate: (topic: string) => {
    const scene = generateSceneForTopic(topic);
    return `Create a flat 2D vector illustration for a parenting blog.

TOPIC: "${topic}"

WHAT TO DRAW:
${scene}

CRITICAL RULES:
1. Objects like blocks, toys, books, food must NOT have faces, eyes, or expressions - they are inanimate
2. Only human characters (parent, child) should have faces
3. Do not draw anthropomorphized objects

STYLE:
- Warm cream/beige background (#FFF5E6)
- Flat vector art, simple shapes, no gradients or 3D effects
- Pastel colors: coral, mint/teal, soft earth tones
- Human characters: closed happy eyes, rosy cheeks, rounded features
- Illustration centered with margins at top and bottom
- No text, watermarks, or logos`;
  }
};

/**
 * WordPress Featured Image Configuration
 * Optimized for blog featured images (portrait format)
 */
export const wordpressImageConfig: ImageGenerationConfig = {
  size: '1024x1792', // Will be resized to 1024x1536 (2:3 standard)
  quality: 'standard',
  style: 'natural',

  promptTemplate: (topic: string) => {
    const scene = generateSceneForTopic(topic);
    return `Create a flat 2D vector illustration for a parenting blog.

TOPIC: "${topic}"

WHAT TO DRAW:
${scene}

CRITICAL RULES:
1. Objects like blocks, toys, books, food must NOT have faces, eyes, or expressions - they are inanimate
2. Only human characters (parent, child) should have faces
3. Do not draw anthropomorphized objects

STYLE:
- Warm cream/beige background (#FFF5E6)
- Flat vector art, simple shapes, no gradients or 3D effects
- Pastel colors: coral, mint/teal, soft earth tones
- Human characters: closed happy eyes, rosy cheeks, rounded features
- Illustration centered with margins at top and bottom
- No text, watermarks, or logos`;
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
