import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AdsterraDomain, AdsterraPlacement, AdsterraData } from './types';

const BASE_URL = 'https://api3.adsterratools.com';

export class AdsterraApiService {
  private token: string;

  constructor() {
    this.token = env.ADSTERRA_API_TOKEN;
  }

  private get headers(): Record<string, string> {
    return {
      'X-API-Key': this.token,
      'Content-Type': 'application/json',
    };
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Adsterra API ${response.status}: ${response.statusText} — ${url}`);
    }

    return response.json() as Promise<T>;
  }

  async fetchDomains(): Promise<AdsterraDomain[]> {
    const data = await this.get<{ data: AdsterraDomain[] }>('/domains');
    return data.data;
  }

  async fetchPlacements(domainId: number): Promise<AdsterraPlacement[]> {
    const data = await this.get<{ data: AdsterraPlacement[] }>(`/domains/${domainId}/zones`);
    return data.data;
  }

  async fetchAdsterraData(): Promise<AdsterraData> {
    const domains = await this.fetchDomains();

    if (domains.length === 0) {
      throw new Error('No domains found in Adsterra account');
    }

    const domain = domains[0];
    const placements = await this.fetchPlacements(domain.id);

    const popunder = placements.find(p => p.title.toLowerCase().includes('popunder'));
    let key = '';

    if (popunder?.direct_url) {
      const match = popunder.direct_url.match(/[?&]key=([a-f0-9]+)/);
      key = match ? match[1] : '';
    }

    if (!key) {
      logger.warn('Could not extract placement key from Adsterra API');
    }

    return {
      domainId: domain.id,
      domain: domain.domain,
      placements,
      key,
    };
  }
}

export { AdsterraData, AdsterraDomain, AdsterraPlacement };
