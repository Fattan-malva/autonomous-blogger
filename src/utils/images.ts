export interface ImagePlan {
  purpose: string;
  description: string;
  altText: string;
  caption: string;
  filename: string;
  placement: string;
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

export function imageUrlFromKeyword(keyword: string, purpose: string): string {
  const seed = slugify(keyword || purpose || 'technology');
  const width = purpose === 'featured' ? 1200 : 800;
  const height = purpose === 'featured' ? 630 : 450;
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

export function imageToHtml(image: ImagePlan): string {
  const src = imageUrlFromKeyword(image.altText || image.description, image.purpose);
  return `<figure style="margin:20px 0;text-align:center;">
  <img src="${src}" alt="${escapeXml(image.altText)}" style="max-width:100%;height:auto;border-radius:8px;" loading="lazy" />
  <figcaption style="font-style:italic;color:#666;margin-top:8px;">${escapeXml(image.caption)}</figcaption>
</figure>`;
}
