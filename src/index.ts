#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GammaClient, GammaApiError } from './client.js';
import { tools } from './tools.js';
import type {
  ListEventsParams,
  GetEventParams,
  GetEventBySlugParams,
  ListMarketsParams,
  GetMarketParams,
  GetMarketBySlugParams,
  SearchParams,
  ListSeriesParams,
  ListTeamsParams,
} from './types.js';

const server = new Server(
  { name: 'polymarket-gamma', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const client = new GammaClient();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs = {} } = request.params;
  const args = rawArgs as Record<string, unknown>;

  try {
    let result: unknown;

    switch (name) {
      case 'list_events':
        result = await client.listEvents(args as ListEventsParams);
        break;
      case 'get_event':
        result = await client.getEvent(args as unknown as GetEventParams);
        break;
      case 'get_event_by_slug':
        result = await client.getEventBySlug(args as unknown as GetEventBySlugParams);
        break;
      case 'list_markets':
        result = await client.listMarkets(args as ListMarketsParams);
        break;
      case 'get_market':
        result = await client.getMarket(args as unknown as GetMarketParams);
        break;
      case 'get_market_by_slug':
        result = await client.getMarketBySlug(args as unknown as GetMarketBySlugParams);
        break;
      case 'search':
        result = await client.search(args as unknown as SearchParams);
        break;
      case 'list_tags':
        result = await client.listTags();
        break;
      case 'list_series':
        result = await client.listSeries(args as ListSeriesParams);
        break;
      case 'list_sports':
        result = await client.listSports();
        break;
      case 'list_teams':
        result = await client.listTeams(args as ListTeamsParams);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message =
      error instanceof GammaApiError
        ? `Gamma API error (${error.status}): ${error.message}`
        : error instanceof Error
          ? error.message
          : 'An unexpected error occurred';

    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Polymarket Gamma MCP Server v1.0.0 running on stdio');
}

main().catch((error) => {
  console.error('Fatal server error:', error);
  process.exit(1);
});
