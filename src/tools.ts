import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const ORDER_ENUM = [
  'volume24hr',
  'volume',
  'liquidity',
  'startDate',
  'endDate',
  'competitive',
  'closedTime',
] as const;

const paginationParams = {
  limit: {
    type: 'integer' as const,
    description:
      'Maximum number of results to return. Range: 1-100. Default: 20.',
    minimum: 1,
    maximum: 100,
  },
  offset: {
    type: 'integer' as const,
    description:
      'Number of results to skip for pagination. Use with limit to page through results. Example: offset=20 with limit=20 returns page 2.',
    minimum: 0,
  },
};

export const tools: Tool[] = [
  // ── Events ──────────────────────────────────────────────────
  {
    name: 'list_events',
    description:
      'List prediction market events from Polymarket. Events are top-level containers that group one or more related binary markets (e.g., "US Presidential Election 2024" is an event containing a market for each candidate). Returns an array of event objects with: id, title, slug, description, active/closed/archived flags, volume (total USD traded), volume24hr, liquidity, openInterest, startDate, endDate, category, commentCount, and a nested "markets" array with each market\'s prices and trading data. Use active=true and closed=false for currently tradable events. Use order="volume_24hr" to find trending events.',
    inputSchema: {
      type: 'object',
      properties: {
        active: {
          type: 'boolean',
          description:
            'Filter by active status. true = currently tradable events, false = inactive. Omit to include both.',
        },
        closed: {
          type: 'boolean',
          description:
            'Filter by closed/resolved status. true = settled events, false = still open. Omit to include both.',
        },
        archived: {
          type: 'boolean',
          description:
            'Filter by archived status. Archived events are old closed events hidden from the main view.',
        },
        tag_id: {
          type: 'string',
          description:
            'Filter events by a tag/category ID. Use list_tags to discover valid tag IDs (e.g., Politics, Crypto, Sports).',
        },
        exclude_tag_id: {
          type: 'string',
          description: 'Exclude events matching this tag ID from results.',
        },
        related_tags: {
          type: 'boolean',
          description:
            'When true and tag_id is set, also include events from related/child tags.',
        },
        order: {
          type: 'string',
          description: 'Sort results by this field.',
          enum: ORDER_ENUM,
        },
        ascending: {
          type: 'boolean',
          description:
            'Sort direction. true = ascending (lowest first), false = descending (highest first). Default: false.',
        },
        ...paginationParams,
      },
    },
  },
  {
    name: 'get_event',
    description:
      'Get a single Polymarket event by its numeric ID. Returns a complete event object including all nested markets with current prices (outcomePrices), outcomes, volume, liquidity, and trading status. Use this when you already have an event ID from list_events or search results.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The numeric event ID. Example: "903"',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_event_by_slug',
    description:
      'Get a single Polymarket event by its URL slug. The slug is the human-readable identifier from a Polymarket URL (e.g., polymarket.com/event/presidential-election-winner-2024 → slug is "presidential-election-winner-2024"). Returns the same complete event object as get_event with all nested markets.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'The event URL slug (lowercase, hyphen-separated). Example: "presidential-election-winner-2024"',
        },
      },
      required: ['slug'],
    },
  },

  // ── Markets ─────────────────────────────────────────────────
  {
    name: 'list_markets',
    description:
      'List individual prediction markets from Polymarket. A market is a single tradable yes/no question (e.g., "Will Bitcoin exceed $100k by March 2026?"). Returns market objects with: id, question, slug, outcomePrices (current YES/NO probabilities 0-1), outcomes, volume, liquidity, bestBid, bestAsk, spread, lastTradePrice, oneDayPriceChange, oneWeekPriceChange, conditionId, clobTokenIds, and active/closed status. Markets belong to events — use list_events to browse by topic, or list_markets for flat listing of all questions.',
    inputSchema: {
      type: 'object',
      properties: {
        active: {
          type: 'boolean',
          description:
            'Filter by active status. true = currently tradable markets.',
        },
        closed: {
          type: 'boolean',
          description:
            'Filter by closed/resolved status. true = settled markets.',
        },
        archived: {
          type: 'boolean',
          description: 'Filter by archived status.',
        },
        enableOrderBook: {
          type: 'boolean',
          description:
            'Filter for markets with order book (CLOB) trading enabled. true = only CLOB-tradable markets.',
        },
        tag_id: {
          type: 'string',
          description: 'Filter markets by a tag/category ID.',
        },
        order: {
          type: 'string',
          description: 'Sort results by this field.',
          enum: ORDER_ENUM,
        },
        ascending: {
          type: 'boolean',
          description:
            'Sort direction. true = ascending, false = descending. Default: false.',
        },
        ...paginationParams,
      },
    },
  },
  {
    name: 'get_market',
    description:
      'Get a single Polymarket market by its numeric ID. Returns complete market data: current prices (outcomePrices), outcomes, order book status (bestBid, bestAsk, spread), volume metrics (volume, volume24hr), price changes (oneDayPriceChange, oneWeekPriceChange), on-chain identifiers (conditionId, clobTokenIds), and resolution details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The numeric market ID. Example: "239826"',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_market_by_slug',
    description:
      'Get a single Polymarket market by its URL slug. Returns the same complete market object as get_market. Use when you have a slug from a Polymarket market URL.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'The market URL slug (lowercase, hyphen-separated). Example: "will-bitcoin-hit-100k-by-march-2026"',
        },
      },
      required: ['slug'],
    },
  },

  // ── Discovery ───────────────────────────────────────────────
  {
    name: 'search',
    description:
      'Search across Polymarket events, markets, and tags by keyword. This is the primary discovery tool — use it to find markets on any topic (e.g., "bitcoin", "trump", "super bowl"). Returns an object with "events" and "tags" arrays. Event results include full nested markets with current prices, so you get everything in a single call.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query string. Searches across event titles, descriptions, market questions, and tags. Example: "bitcoin price"',
        },
        ...paginationParams,
      },
      required: ['query'],
    },
  },
  {
    name: 'list_tags',
    description:
      'List all available tags/categories on Polymarket. Tags categorize events into topics like Politics, Crypto, Sports, Pop Culture, etc. Returns an array of tag objects with: id, label, slug. Use the tag "id" with list_events or list_markets (tag_id parameter) to filter by category. No parameters required.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_series',
    description:
      'List event series on Polymarket. A series groups recurring events of the same type (e.g., "NBA" groups all NBA game events, "Weekly Bitcoin Price" groups recurring price prediction events). Returns series objects with: id, title, slug, seriesType, recurrence (daily/weekly/etc), active/closed status, volume24hr, and commentCount.',
    inputSchema: {
      type: 'object',
      properties: {
        ...paginationParams,
      },
    },
  },
  {
    name: 'list_sports',
    description:
      'List all sports categories on Polymarket. Returns sport objects with: id, sport (league name like "nba", "nfl", "mlb"), image, tags (comma-separated tag IDs you can use with list_events), series (series ID), and ordering. Use this to discover which sports leagues have active prediction markets.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_teams',
    description:
      'List sports teams tracked on Polymarket. Returns team objects with: id, name, league, abbreviation, logo (image URL), color (hex brand color), providerId, and win/loss record. Useful for sports-related market discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        ...paginationParams,
      },
    },
  },
];
