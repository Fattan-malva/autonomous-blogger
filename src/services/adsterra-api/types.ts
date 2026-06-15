export interface AdsterraDomain {
  id: number;
  domain: string;
  status: string;
}

export interface AdsterraPlacement {
  id: number;
  domain_id: number;
  title: string;
  alias: string;
  direct_url: string | null;
}

export interface AdsterraData {
  domainId: number;
  domain: string;
  placements: AdsterraPlacement[];
  key: string;
}
