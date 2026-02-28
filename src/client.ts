import {
  type GammaClientConfig,
  type RetryConfig,
  type ListEventsParams,
  type GetEventParams,
  type GetEventBySlugParams,
  type ListMarketsParams,
  type GetMarketParams,
  type GetMarketBySlugParams,
  type SearchParams,
  type ListSeriesParams,
  type ListTeamsParams,
  type OrderField,
  VALID_ORDER_FIELDS,
} from './types.js';

// Custom error class — exposes status info without stack traces
export class GammaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: string,
  ) {
    super(`HTTP ${status}: ${statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`);
    this.name = 'GammaApiError';
  }
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

const DEFAULT_BASE_URL = 'https://gamma-api.polymarket.com';
const DEFAULT_TIMEOUT = 15000;

export class GammaClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;

  constructor(config?: GammaClientConfig) {
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.retryConfig = {
      ...DEFAULT_RETRY,
      ...config?.retry,
    };
  }

  // --- Public endpoint methods ---

  async listEvents(params: ListEventsParams): Promise<unknown> {
    if (params.order) this.validateOrder(params.order);
    return this.fetchWithRetry(
      this.buildUrl('/events', {
        active: params.active,
        closed: params.closed,
        archived: params.archived,
        tag_id: params.tag_id,
        exclude_tag_id: params.exclude_tag_id,
        related_tags: params.related_tags,
        order: params.order,
        ascending: params.ascending,
        limit: this.clampLimit(params.limit),
        offset: this.clampOffset(params.offset),
      }),
    );
  }

  async getEvent(params: GetEventParams): Promise<unknown> {
    const id = this.sanitizePathSegment(params.id, 'id');
    return this.fetchWithRetry(this.buildUrl(`/events/${id}`));
  }

  async getEventBySlug(params: GetEventBySlugParams): Promise<unknown> {
    const slug = this.sanitizePathSegment(params.slug, 'slug');
    return this.fetchWithRetry(this.buildUrl(`/events/slug/${slug}`));
  }

  async listMarkets(params: ListMarketsParams): Promise<unknown> {
    if (params.order) this.validateOrder(params.order);
    return this.fetchWithRetry(
      this.buildUrl('/markets', {
        active: params.active,
        closed: params.closed,
        archived: params.archived,
        enableOrderBook: params.enableOrderBook,
        tag_id: params.tag_id,
        order: params.order,
        ascending: params.ascending,
        limit: this.clampLimit(params.limit),
        offset: this.clampOffset(params.offset),
      }),
    );
  }

  async getMarket(params: GetMarketParams): Promise<unknown> {
    const id = this.sanitizePathSegment(params.id, 'id');
    return this.fetchWithRetry(this.buildUrl(`/markets/${id}`));
  }

  async getMarketBySlug(params: GetMarketBySlugParams): Promise<unknown> {
    const slug = this.sanitizePathSegment(params.slug, 'slug');
    return this.fetchWithRetry(this.buildUrl(`/markets/slug/${slug}`));
  }

  async search(params: SearchParams): Promise<unknown> {
    const query = params.query?.trim();
    if (!query) throw new Error('Search query cannot be empty');
    return this.fetchWithRetry(
      this.buildUrl('/public-search', {
        q: query,
        limit: this.clampLimit(params.limit),
        offset: this.clampOffset(params.offset),
      }),
    );
  }

  async listTags(): Promise<unknown> {
    return this.fetchWithRetry(this.buildUrl('/tags'));
  }

  async listSeries(params: ListSeriesParams): Promise<unknown> {
    return this.fetchWithRetry(
      this.buildUrl('/series', {
        limit: this.clampLimit(params.limit),
        offset: this.clampOffset(params.offset),
      }),
    );
  }

  async listSports(): Promise<unknown> {
    return this.fetchWithRetry(this.buildUrl('/sports'));
  }

  async listTeams(params: ListTeamsParams): Promise<unknown> {
    return this.fetchWithRetry(
      this.buildUrl('/teams', {
        limit: this.clampLimit(params.limit),
        offset: this.clampOffset(params.offset),
      }),
    );
  }

  // --- Security: Input validation ---

  private sanitizePathSegment(value: string, type: 'id' | 'slug'): string {
    if (!value || typeof value !== 'string') {
      throw new Error(`Invalid ${type}: must be a non-empty string`);
    }

    if (value.length > 500) {
      throw new Error(`Invalid ${type}: exceeds maximum length of 500 characters`);
    }

    if (type === 'id') {
      if (!/^[0-9]+$/.test(value)) {
        throw new Error(
          `Invalid ${type}: "${value}" must contain only digits`,
        );
      }
    } else {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(value)) {
        throw new Error(
          `Invalid slug: "${value}" must contain only alphanumeric characters and hyphens, starting with an alphanumeric character`,
        );
      }
    }

    return value;
  }

  private validateOrder(order: string): void {
    if (!VALID_ORDER_FIELDS.includes(order as OrderField)) {
      throw new Error(
        `Invalid order field: "${order}". Must be one of: ${VALID_ORDER_FIELDS.join(', ')}`,
      );
    }
  }

  private clampLimit(limit?: number): number | undefined {
    if (limit === undefined || limit === null) return undefined;
    return Math.max(1, Math.min(100, Math.floor(limit)));
  }

  private clampOffset(offset?: number): number | undefined {
    if (offset === undefined || offset === null) return undefined;
    return Math.max(0, Math.floor(offset));
  }

  // --- URL construction ---

  private buildUrl(
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(path, this.baseUrl);

    if (queryParams) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(queryParams)) {
        if (val !== undefined && val !== null) {
          searchParams.set(key, String(val));
        }
      }
      const qs = searchParams.toString();
      if (qs) url.search = qs;
    }

    return url.toString();
  }

  // --- Fetch with exponential backoff ---

  private async fetchWithRetry(url: string): Promise<unknown> {
    const { maxRetries, baseDelay, maxDelay } = this.retryConfig;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          return await response.json();
        }

        // Non-retryable HTTP error or last attempt
        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxRetries) {
          const body = await response.text().catch(() => undefined);
          throw new GammaApiError(response.status, response.statusText, body);
        }

        // Retryable — wait with exponential backoff + jitter
        await this.backoff(attempt, baseDelay, maxDelay);
      } catch (error) {
        clearTimeout(timeoutId);

        // Already a GammaApiError — rethrow
        if (error instanceof GammaApiError) throw error;

        // Timeout (AbortError) — retry if attempts remain
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (attempt === maxRetries) {
            throw new GammaApiError(0, `Request timed out after ${this.timeout}ms`);
          }
          await this.backoff(attempt, baseDelay, maxDelay);
          continue;
        }

        // Network error — retry if attempts remain
        if (error instanceof TypeError && attempt < maxRetries) {
          await this.backoff(attempt, baseDelay, maxDelay);
          continue;
        }

        throw error;
      }
    }

    // Should not reach here, but TypeScript needs it
    throw new GammaApiError(0, 'Retry attempts exhausted');
  }

  private async backoff(attempt: number, baseDelay: number, maxDelay: number): Promise<void> {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = delay * 0.5 * Math.random();
    await this.sleep(delay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
