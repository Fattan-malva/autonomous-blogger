import { google, webmasters_v3 } from 'googleapis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { OAuth2Client } from 'google-auth-library';

let searchConsoleClient: webmasters_v3.Webmasters | null = null;

function getAuthClient(): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    env.SEARCH_CONSOLE_CLIENT_ID,
    env.SEARCH_CONSOLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: env.SEARCH_CONSOLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

export function initSearchConsole(): void {
  const auth = getAuthClient();
  searchConsoleClient = google.webmasters({ version: 'v3', auth });
  logger.info('Search Console client initialized');
}

export interface SearchAnalyticsQuery {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}

export interface SearchAnalyticsRow {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  keys: string[];
}

export interface SearchAnalyticsResponse {
  rows: SearchAnalyticsRow[];
  responseAggregationType?: string;
}

export async function querySearchAnalytics(
  siteUrl: string,
  query: SearchAnalyticsQuery
): Promise<SearchAnalyticsResponse> {
  if (!searchConsoleClient) {
    initSearchConsole();
  }

  try {
    const response = await searchConsoleClient!.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: query.startDate,
        endDate: query.endDate,
        dimensions: query.dimensions || ['query'],
        rowLimit: query.rowLimit || 1000,
      },
    });

    return {
      rows: (response.data.rows || []).map((row) => ({
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
        keys: row.keys || [],
      })),
      responseAggregationType: response.data.responseAggregationType || undefined,
    };
  } catch (error) {
    logger.error('Search Console query failed', { error });
    throw error;
  }
}

export async function getSiteUrl(): Promise<string> {
  if (!searchConsoleClient) {
    initSearchConsole();
  }

  try {
    const response = await searchConsoleClient!.sites.list();
    const sites = response.data.siteEntry || [];
    if (sites.length === 0) {
      throw new Error('No sites found in Search Console');
    }
    return sites[0].siteUrl || '';
  } catch (error) {
    logger.error('Failed to get Search Console site', { error });
    throw error;
  }
}

export async function submitUrlForIndexing(url: string): Promise<boolean> {
  try {
    const auth = getAuthClient();
    const indexingClient = google.indexing({ version: 'v3', auth });

    await indexingClient.urlNotifications.publish({
      requestBody: {
        url,
        type: 'URL_UPDATED',
      } as any,
    });

    logger.info('URL submitted for indexing', { url });
    return true;
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const msg = status === 401
      ? 'Indexing API: 401 unauthorized_client — pastikan Indexing API sudah di-enable di Google Cloud Console dan refresh token discope ke https://www.googleapis.com/auth/indexing'
      : `Indexing API gagal: ${(error as Error).message}`;
    logger.error(msg, { url, error });
    return false;
  }
}
