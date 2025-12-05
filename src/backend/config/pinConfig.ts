/**
 * Pinterest Pin Configuration for Parent Village
 * Defines pin styles, optimization rules, and generation parameters
 */

export interface PinVariation {
  name: string;
  titleTemplate: string;
  descriptionTemplate: string;
  angle: string;
  keywords: string[];
}

// Reduced to 2 high-performing pin variations per article
// (Pinterest best practices: How-To and Listicle formats perform best)
export const pinVariations: PinVariation[] = [
  {
    name: 'How-To Pin',
    titleTemplate: 'How to {benefit}',
    descriptionTemplate:
      'Discover practical tips to {action}. This guide shows you {detail} for {age_group}. Simple strategies that work! {cta}',
    angle: 'Instructional/Step-by-step',
    keywords: ['how to', 'tips', 'guide', 'tutorial']
  },
  {
    name: 'Quick Tips Pin',
    titleTemplate: '{number} Ways to {benefit}',
    descriptionTemplate:
      '{number} simple ways to {action} for your {age_group}. These practical tips help with {detail}. Which one will you try first? {cta}',
    angle: 'Listicle/Multiple solutions',
    keywords: ['tips', 'ways', 'ideas', 'simple']
  }
];

export interface PinMetadata {
  title: string;
  description: string;
  link: string;
  imageUrl?: string;
  altText: string;
  boardName?: string;
  dominantColor?: string;
  angle: string;
}

export interface SavedPin {
  id: string;
  articleTitle: string;
  articleId?: number;
  postId?: number;
  variations: PinMetadata[];
  suggestedTags: string[];
  createdAt: string;
  status: 'draft' | 'approved' | 'published';
  approvedAt?: string;
  publishedAt?: string;
  notes?: string;
}

export const parentVillagePinConfig = {
  // Pinterest Board Settings
  boardNamingPattern: '{topic}', // e.g., "Toddler Sleep Routines"

  // Image Settings
  imageHeight: 1500,
  imageWidth: 1000,
  aspectRatio: '2:3', // Pinterest standard

  // Title Settings
  titleMaxChars: 100,
  titleMinChars: 30,
  titleKeywords: true, // Include article keywords

  // Description Settings
  descriptionMaxChars: 800,
  descriptionMinChars: 50,
  includeHashtags: true,
  hashtagCount: 5,

  // Content Strategy
  tone: 'Warm, helpful, actionable',
  audienceSegments: {
    parents: true,
    caregivers: true,
    educators: true
  },

  // Default CTA (Call-to-action)
  defaultCta: 'Tap to learn more parenting tips!',
  altCtaOptions: [
    'Save this pin for later!',
    'Learn what works for your family!',
    'Discover more at Parent Village!',
    'Get the full guide now!'
  ],

  // Tag Strategy
  standardTags: [
    '#parentingtips',
    '#parenthood',
    '#parentingadvice',
    '#earlychildhood',
    '#momlife'
  ],

  ageGroupTags: {
    infant: ['#newbornmom', '#babytips', '#infantcare'],
    toddler: ['#toddlerlife', '#toddlerparenting', '#toddleractivities'],
    preschool: [
      '#preschooler',
      '#preschoolermom',
      '#preschoolactivities'
    ],
    elementary: ['#elementarykids', '#schoolage', '#parentingkids']
  },

  trendingTags: [
    '#parentsofpinterest',
    '#familytime',
    '#parenting101',
    '#parentwins',
    '#raisingkids',
    '#parentingjourney',
    '#mindfulparenting',
    '#parentingcommunity'
  ],

  // Age Group Detection
  ageGroupKeywords: {
    infant: ['infant', 'newborn', 'baby', '0-12 months'],
    toddler: ['toddler', 'toddlers', '1-3 years', '12-36 months'],
    preschool: ['preschool', 'preschooler', '3-5 years', 'pre-k'],
    elementary: ['elementary', 'school age', 'school-age', '5-8 years']
  }
};

export default parentVillagePinConfig;
