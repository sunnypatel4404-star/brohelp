import OpenAI from 'openai';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const prompt = `Create a tall Pinterest-style illustration (2:3 aspect ratio) inspired by soft, modern children's book art. Use a warm beige background and a gentle pastel color palette: muted teal, soft terracotta, dusty yellow, sage green, and peach. The illustration should be clean, flat, and minimalist with smooth rounded shapes and no harsh outlines.

Depict a cozy scene with young children and toys in a warm, family-friendly atmosphere. Characters should be simple and charming, with tiny dot eyes, soft curved smiles, and very minimal facial features. Use rounded limbs, smooth silhouettes, and soft shading that feels airy and gentle.

Include simple pastel props such as wooden blocks, stacking toys, balls, or books that match the calm, muted palette. Everything should have a cohesive flat-vector style with softened shadows and a slightly textured paper-like softness.

At the top, place the title in bold, clean, centered text: "Kids and Toys" in muted teal. Beneath it, add a small subtitle in muted terracotta: "Parenting Article". At the bottom center, include the text "ParentVillage.blog" in muted teal in a clean, rounded font.

The overall mood should be warm, soft, inviting, and minimalist — matching the calm, cozy aesthetic of modern pastel parenting illustrations used for Pinterest.`;

async function main() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log('🎨 Testing ChatGPT prompt with DALL-E 3 API...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PROMPT:\n');
  console.log(prompt);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1792',
    quality: 'hd',
    style: 'natural'
  });

  console.log('✅ Image generated!');
  console.log('Revised prompt:', response.data?.[0]?.revised_prompt?.substring(0, 300) + '...\n');

  // Download and save
  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL');
  const imageResponse = await fetch(imageUrl);
  const buffer = await imageResponse.arrayBuffer();

  const filename = 'generated_images/test_chatgpt_prompt_' + Date.now() + '.png';
  fs.writeFileSync(filename, Buffer.from(buffer));
  console.log('📁 Saved to:', filename);
}

main().catch(console.error);
