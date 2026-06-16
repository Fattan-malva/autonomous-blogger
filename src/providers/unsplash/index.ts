import { env } from '../../config/env';
import { logger } from '../../config/logger';

const BASE_URL = 'https://api.unsplash.com';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

interface UnsplashPhoto {
    id: string;
    urls: {
        raw: string;
        regular: string;
        small: string;
        thumb: string;
    };
    alt_description: string | null;
    description: string | null;
    user: {
        name: string;
        username: string;
    };
    width: number;
    height: number;
}

interface UnsplashSearchResponse {
    total: number;
    total_pages: number;
    results: UnsplashPhoto[];
}

interface UnsplashPhotoResult {
    url: string;
    alt: string;
    author: string;
    width: number;
    height: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function hasApiKey(): boolean {
    return !!env.UNSPLASH_ACCESS_KEY;
}

function buildHeaders(): Record<string, string> {
    return {
        'Authorization': `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
    };
}

async function fetchWithRetry(url: string): Promise<UnsplashSearchResponse | null> {
    if (!hasApiKey()) {
        logger.warn('UNSPLASH_ACCESS_KEY not configured');
        return null;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: buildHeaders(),
            });

            if (response.ok) {
                return await response.json() as UnsplashSearchResponse;
            }

            if (response.status === 429) {
                logger.warn(`Unsplash rate limit hit (attempt ${attempt}/${MAX_RETRIES})`);
                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS * attempt * 2);
                    continue;
                }
            }

            logger.error(`Unsplash API error: ${response.status} ${response.statusText}`);
            return null;
        } catch (error) {
            logger.warn(`Unsplash fetch failed (attempt ${attempt}/${MAX_RETRIES}): ${(error as Error).message}`);
            if (attempt < MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS * attempt);
            }
        }
    }

    return null;
}

export async function searchPhotos(
    query: string,
    options: {
        perPage?: number;
        page?: number;
        orientation?: 'landscape' | 'portrait' | 'squarish';
    } = {}
): Promise<UnsplashPhotoResult[]> {
    const { perPage = 5, page = 1, orientation = 'landscape' } = options;

    const encodedQuery = encodeURIComponent(query.trim());
    const url = `${BASE_URL}/search/photos?query=${encodedQuery}&per_page=${perPage}&page=${page}&orientation=${orientation}`;

    const data = await fetchWithRetry(url);
    if (!data || data.results.length === 0) {
        return [];
    }

    return data.results.map(photo => ({
        url: photo.urls.regular,
        alt: photo.alt_description || photo.description || query,
        author: photo.user.name,
        width: photo.width,
        height: photo.height,
    }));
}

export async function getRandomPhoto(
    query: string,
    options: {
        orientation?: 'landscape' | 'portrait' | 'squarish';
        width?: number;
    } = {}
): Promise<UnsplashPhotoResult | null> {
    const { orientation = 'landscape', width = 1200 } = options;

    const encodedQuery = encodeURIComponent(query.trim());
    const url = `${BASE_URL}/photos/random?query=${encodedQuery}&orientation=${orientation}&w=${width}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        if (!response.ok) {
            return null;
        }

        const photo = await response.json() as UnsplashPhoto;
        return {
            url: photo.urls.regular,
            alt: photo.alt_description || photo.description || query,
            author: photo.user.name,
            width: photo.width,
            height: photo.height,
        };
    } catch (error) {
        logger.warn(`Unsplash random photo failed: ${(error as Error).message}`);
        return null;
    }
}

export async function findBestPhoto(
    queries: string[],
    options: {
        orientation?: 'landscape' | 'portrait' | 'squarish';
        width?: number;
    } = {}
): Promise<UnsplashPhotoResult | null> {
    if (!hasApiKey()) return null;

    for (const query of queries) {
        if (!query || query.trim().length < 2) continue;

        const results = await searchPhotos(query, {
            perPage: 3,
            orientation: options.orientation,
        });

        if (results.length > 0) {
            return results[0];
        }

        await sleep(200);
    }

    return null;
}

export { hasApiKey };
