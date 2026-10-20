export const referenceAssets = [
  {
    "role": "Dawn sky over the Korean peninsula",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHTHH8_2VKFT08X2D8PAT1D/5647a229-1ef7-4181-b55f-b4bf32bbb0d4.png?w=2200&format=auto&compress=true"
  },
  {
    "role": "Granite ridges of Seoraksan above a sea of cloud at dawn",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHTH1W_WVE0JJ5ND4CPE6S6/3cacaf45-6d22-4b58-8a21-dda490f766e0.png?w=2200&format=auto&compress=true"
  },
  {
    "role": "image",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GJA6RE_XEV5MEKT481YNWEJ/ridge-silhouette-web.png?w=2200&format=auto"
  },
  {
    "role": "A woman in hanbok looking out over the valley",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GJKCT1_132NEW0TFFHHXE16/hanbok-figure-web.png?w=760&format=auto"
  },
  {
    "role": "video",
    "url": "https://video.gumlet.io/6a7e9e0f2621db881577453e/6aa838db07a6f8ff298d2f4f/main.mp4"
  },
  {
    "role": "video",
    "url": "https://video.gumlet.io/6a7e9e0f2621db881577453e/6aa838db400e7c181696f346/main.mp4"
  },
  {
    "role": "video",
    "url": "https://video.gumlet.io/6a7e9e0f2621db881577453e/6aa838dbae2b40af2a01e26d/main.mp4"
  },
  {
    "role": "video",
    "url": "https://video.gumlet.io/6a7e9e0f2621db881577453e/6aa838dc400e7c181696f34c/main.mp4"
  },
  {
    "role": "video",
    "url": "https://video.gumlet.io/6a7e9e0f2621db881577453e/6aa838dc400e7c181696f34f/main.mp4"
  },
  {
    "role": "Gyeongbokgung roofs against the Seoul skyline",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHV64C_DHXPJ2XKPW0S50CV/5c5a6067-5ac0-42c2-ad31-ae2208ba6386.png?w=560&format=auto&compress=true"
  },
  {
    "role": "An Euljiro alley at blue hour",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHV6G5_HYGYQJA0TJ2NYZ82/b687b95b-be0e-4051-bafd-4044a508560b.png?w=560&format=auto&compress=true"
  },
  {
    "role": "Tiled roofs of Jeonju Hanok Village",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHV6Y3_BX1AC9356R5C8ZS5/b52d08e9-e489-4ed4-9bcb-34558d8ce6d4.png?w=560&format=auto&compress=true"
  },
  {
    "role": "Celadon tea set on a low table inside a hanok",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHV7NM_9C7MXPCJB30SYKHX/9c1d1fd3-6bdf-4606-b019-bb2fa3b6c039.png?w=560&format=auto&compress=true"
  },
  {
    "role": "Haeundae beach and the Busan skyline at dusk",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHV81D_KW5DFA8DQ5YX0TV1/5c21b13c-14e4-4d55-a66a-93ab89219b24.png?w=560&format=auto&compress=true"
  },
  {
    "role": "Jagalchi fish market at dawn",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHV8CB_7V7MA23B34WFZEDW/00e150bc-46f6-4289-b82c-9b8d9357faf7.png?w=560&format=auto&compress=true"
  },
  {
    "role": "Stone pagoda in Gyeongju framed by cherry blossom at sunrise",
    "url": "https://hanbitkorea.gumlet.io/fetch/https://pub.hyperagent.com/api/published/pbf01M2GHTJBD_CTSD4PR5KB07QVX5/67d224be-16f4-4d08-a042-2e3a745ec129.png?w=2200&format=auto&compress=true"
  }
] as const;
export const assets = { sky: referenceAssets[0].url, ridge: referenceAssets[1].url, silhouette: referenceAssets[2].url, figure: referenceAssets[3].url, videos: referenceAssets.slice(4, 9).map(a => a.url), cities: referenceAssets.slice(9, 15), closing: referenceAssets[15].url, campaign: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80", preview: "https://media.scrollhaus.ai/previews/hanbit-korea.stream-eb5095fd.mp4", poster: "https://scrollhaus.ai/thumbs/hanbit-korea.webp" };

export interface ClothingPiece {
  id: string;
  slug: string;
  tag: 'WOMEN' | 'MEN';
  title: string;
  fabric: string;
  description: string;
  image: string;
  category: string;
}

export const clothingPieces: ClothingPiece[] = [
  {
    id: 'women-wool-trench',
    slug: 'sculpted-wool-trench',
    tag: 'WOMEN',
    title: 'Sculpted Wool Trench',
    fabric: '100% Virgin Wool Twill',
    description: 'Generous raglan sleeves, storm flap, and fluid unlined drape.',
    image: 'https://images.unsplash.com/photo-1683393092542-74689e4b8367?auto=format&fit=crop&w=800&q=80',
    category: 'Outerwear',
  },
  {
    id: 'men-tailored-coat',
    slug: 'tailored-wool-overcoat',
    tag: 'MEN',
    title: 'Tailored Wool Overcoat',
    fabric: 'Heavy Italian Worsted Wool',
    description: 'Clean notch lapel, natural horn buttons, and straight unhurried cut.',
    image: 'https://images.unsplash.com/photo-1787436025288-874f0696fcca?auto=format&fit=crop&w=800&q=80',
    category: 'Outerwear',
  },
  {
    id: 'women-cashmere-knit',
    slug: 'spun-cashmere-rib',
    tag: 'WOMEN',
    title: 'Spun Cashmere Rib',
    fabric: 'Combed Cashmere & Silk',
    description: 'Whisper-soft ribbed knit designed for lightweight seasonal warmth.',
    image: 'https://images.unsplash.com/photo-1625795550960-9558411bae05?auto=format&fit=crop&w=800&q=80',
    category: 'Knitwear',
  },
  {
    id: 'men-linen-blazer',
    slug: 'relaxed-wool-blazer',
    tag: 'MEN',
    title: 'Relaxed Wool Blazer',
    fabric: 'Breathable Wool-Linen Weave',
    description: 'Unstructured shoulder with patch pockets for effortless daily elegance.',
    image: 'https://images.unsplash.com/photo-1453396450673-3fe83d2db2c4?auto=format&fit=crop&w=800&q=80',
    category: 'Tops',
  },
  {
    id: 'women-silk-dress',
    slug: 'sandwashed-silk-dress',
    tag: 'WOMEN',
    title: 'Sandwashed Silk Dress',
    fabric: '100% Pure Mulberry Silk',
    description: 'Fluid bias-cut drape with a soft natural matte sheen and ease of movement.',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80',
    category: 'Dresses',
  },
];


export const campaignBackdrop = "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=2000&q=80";
