export type OrderField =
  | 'volume24hr'
  | 'volume'
  | 'liquidity'
  | 'startDate'
  | 'endDate'
  | 'competitive'
  | 'closedTime';

export const VALID_ORDER_FIELDS: OrderField[] = [
  'volume24hr',
  'volume',
  'liquidity',
  'startDate',
  'endDate',
  'competitive',
  'closedTime',
];

// Tool input parameter interfaces

export interface ListEventsParams {
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  tag_id?: string;
  exclude_tag_id?: string;
  related_tags?: boolean;
  order?: OrderField;
  ascending?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetEventParams {
  id: string;
}

export interface GetEventBySlugParams {
  slug: string;
}

export interface ListMarketsParams {
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  enableOrderBook?: boolean;
  tag_id?: string;
  order?: OrderField;
  ascending?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetMarketParams {
  id: string;
}

export interface GetMarketBySlugParams {
  slug: string;
}

export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
}

export interface ListSeriesParams {
  limit?: number;
  offset?: number;
}

export interface ListTeamsParams {
  limit?: number;
  offset?: number;
}

// Client configuration

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export interface GammaClientConfig {
  baseUrl?: string;
  timeout?: number;
  retry?: Partial<RetryConfig>;
}
