import { searchPhotos, hasApiKey } from '../providers/unsplash';

export interface ImagePlan {
  purpose: string;
  description: string;
  altText: string;
  caption: string;
  filename: string;
  placement: string;
  searchQuery?: string;
  imageUrl?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function placeholderUrl(keyword: string, purpose: string): string {
  const width = purpose === 'featured' ? 1200 : 800;
  const height = purpose === 'featured' ? 630 : 450;
  const terms = keyword
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4)
    .join(' ');
  const text = encodeURIComponent(terms || 'image');
  return `https://placehold.co/${width}x${height}/2563eb/FFFFFF?text=${text}&font=raleway`;
}

export async function fetchUnsplashImages(
  plans: ImagePlan[],
  articleKeyword: string
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  if (!hasApiKey()) {
    return urlMap;
  }

  for (const plan of plans) {
    const query = plan.searchQuery || plan.altText || plan.description || articleKeyword;
    if (!query || query.trim().length < 2) continue;

    const orientation = plan.purpose === 'featured' ? 'landscape' : 'landscape';

    const results = await searchPhotos(query, {
      perPage: 3,
      orientation,
    });

    if (results.length > 0) {
      urlMap.set(plan.filename, results[0].url);
    }
  }

  return urlMap;
}

export function imageToHtml(image: ImagePlan): string {
  const src = image.imageUrl || placeholderUrl(image.altText || image.description, image.purpose);
  return `<figure style="margin:20px 0;text-align:center;">
  <img src="${src}" alt="${escapeXml(image.altText)}" style="max-width:100%;height:auto;border-radius:8px;" loading="lazy" />
  <figcaption style="font-style:italic;color:#666;margin-top:8px;">${escapeXml(image.caption)}</figcaption>
</figure>`;
}
