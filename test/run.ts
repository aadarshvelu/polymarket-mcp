#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// ── Types ──────────────────────────────────────────────────────

interface TestCase {
  name: string;
  tool: string;
  args: Record<string, unknown>;
  expect: 'success' | 'error';
  validate?: (result: unknown) => string | null; // return error msg or null
}

interface JsonRpcResponse {
  result?: {
    tools?: unknown[];
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { message: string };
}

// ── Test definitions ───────────────────────────────────────────

const tests: TestCase[] = [
  // ── Events ──
  {
    name: 'list_events — active events with limit',
    tool: 'list_events',
    args: { active: true, closed: false, limit: 3 },
    expect: 'success',
    validate: (r) => {
      if (!Array.isArray(r)) return `Expected array, got ${typeof r}`;
      if (r.length === 0) return 'Expected at least 1 event';
      if (!r[0].id || !r[0].title) return 'Missing id or title on event';
      if (!Array.isArray(r[0].markets)) return 'Missing nested markets array';
      return null;
    },
  },
  {
    name: 'list_events — order by volume24hr',
    tool: 'list_events',
    args: { limit: 2, order: 'volume24hr' },
    expect: 'success',
    validate: (r) => {
      if (!Array.isArray(r)) return `Expected array, got ${typeof r}`;
      return null;
    },
  },
  {
    name: 'get_event — by valid ID',
    tool: 'get_event',
    args: { id: '16167' },
    expect: 'success',
    validate: (r: any) => {
      if (!r || typeof r !== 'object') return 'Expected object';
      if (!r.id) return 'Missing event id';
      return null;
    },
  },
  {
    name: 'get_event — path traversal rejected',
    tool: 'get_event',
    args: { id: '../admin' },
    expect: 'error',
    validate: (r: any) => {
      if (!r.error?.includes('must contain only digits')) return 'Expected digit validation error';
      return null;
    },
  },
  {
    name: 'get_event_by_slug — valid slug',
    tool: 'get_event_by_slug',
    args: { slug: 'microstrategy-sell-any-bitcoin-in-2025' },
    expect: 'success',
  },
  {
    name: 'get_event_by_slug — XSS rejected',
    tool: 'get_event_by_slug',
    args: { slug: '<script>alert(1)</script>' },
    expect: 'error',
    validate: (r: any) => {
      if (!r.error?.includes('alphanumeric')) return 'Expected slug validation error';
      return null;
    },
  },

  // ── Markets ──
  {
    name: 'list_markets — active with orderbook',
    tool: 'list_markets',
    args: { active: true, enableOrderBook: true, limit: 3 },
    expect: 'success',
    validate: (r) => {
      if (!Array.isArray(r)) return `Expected array, got ${typeof r}`;
      return null;
    },
  },
  {
    name: 'get_market — by valid ID',
    tool: 'get_market',
    args: { id: '239826' },
    expect: 'success',
    validate: (r: any) => {
      if (!r || !r.id) return 'Missing market id';
      if (!r.outcomes) return 'Missing outcomes';
      return null;
    },
  },
  {
    name: 'get_market — SQL injection rejected',
    tool: 'get_market',
    args: { id: '1; DROP TABLE markets' },
    expect: 'error',
  },
  {
    name: 'get_market_by_slug — valid slug',
    tool: 'get_market_by_slug',
    args: { slug: 'nfl-will-the-falcons-beat-the-panthers-by-more-than-3pt5-points-in-their-october-31st-matchup' },
    expect: 'success',
    validate: (r: any) => {
      if (!r || !r.question) return 'Missing market question';
      return null;
    },
  },

  // ── Discovery ──
  {
    name: 'search — keyword query',
    tool: 'search',
    args: { query: 'bitcoin', limit: 2 },
    expect: 'success',
    validate: (r: any) => {
      if (!r || typeof r !== 'object') return 'Expected object';
      if (!('events' in r)) return 'Missing events key in search results';
      return null;
    },
  },
  {
    name: 'search — empty query rejected',
    tool: 'search',
    args: { query: '   ' },
    expect: 'error',
    validate: (r: any) => {
      if (!r.error?.includes('empty')) return 'Expected empty query error';
      return null;
    },
  },
  {
    name: 'list_tags — no params',
    tool: 'list_tags',
    args: {},
    expect: 'success',
    validate: (r) => {
      if (!Array.isArray(r)) return `Expected array, got ${typeof r}`;
      if (r.length === 0) return 'Expected at least 1 tag';
      if (!r[0].id || !r[0].label) return 'Missing id or label on tag';
      return null;
    },
  },
  {
    name: 'list_series — with pagination',
    tool: 'list_series',
    args: { limit: 5, offset: 0 },
    expect: 'success',
    validate: (r) => {
      if (!Array.isArray(r)) return `Expected array, got ${typeof r}`;
      return null;
    },
  },
  {
    name: 'list_sports — no params',
    tool: 'list_sports',
    args: {},
    expect: 'success',
    validate: (r) => {
      if (!Array.isArray(r)) return `Expected array, got ${typeof r}`;
      if (r.length === 0) return 'Expected at least 1 sport';
      return null;
    },
  },
  {
    name: 'list_teams — with limit',
    tool: 'list_teams',
    args: { limit: 5 },
    expect: 'success',
    validate: (r) => {
      if (!Array.isArray(r)) return `Expected array, got ${typeof r}`;
      return null;
    },
  },

  // ── Security edge cases ──
  {
    name: 'list_events — invalid order rejected',
    tool: 'list_events',
    args: { order: 'DROP TABLE events' },
    expect: 'error',
    validate: (r: any) => {
      if (!r.error?.includes('Invalid order field')) return 'Expected order validation error';
      return null;
    },
  },
  {
    name: 'get_event — missing required ID',
    tool: 'get_event',
    args: {},
    expect: 'error',
  },
  {
    name: 'unknown_tool — rejected',
    tool: 'nonexistent_tool',
    args: {},
    expect: 'error',
    validate: (r: any) => {
      if (!r.error?.includes('Unknown tool')) return 'Expected unknown tool error';
      return null;
    },
  },
];

// ── Runner ─────────────────────────────────────────────────────

const PASS = '\x1b[32m PASS \x1b[0m';
const FAIL = '\x1b[31m FAIL \x1b[0m';
const SKIP = '\x1b[33m SKIP \x1b[0m';

function sendRpc(
  proc: ReturnType<typeof spawn>,
  id: number,
  method: string,
  params?: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    let buf = '';

    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      // MCP SDK may send multiple messages; find our id
      for (const line of buf.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === id) {
            proc.stdout!.off('data', onData);
            resolve(parsed);
            return;
          }
        } catch {
          // partial JSON, keep buffering
        }
      }
    };

    const timeout = setTimeout(() => {
      proc.stdout!.off('data', onData);
      reject(new Error('Timeout waiting for response'));
    }, 30000);

    proc.stdout!.on('data', onData);
    proc.stdin!.write(msg + '\n');

    // Clean up timeout on resolve
    const origResolve = resolve;
    resolve = ((val: JsonRpcResponse) => {
      clearTimeout(timeout);
      origResolve(val);
    }) as typeof resolve;
  });
}

async function main() {
  const serverPath = resolve(import.meta.dirname!, '..', 'dist', 'index.js');

  console.log('\n\x1b[1m  Polymarket Gamma MCP — Test Suite\x1b[0m');
  console.log(`  Server: ${serverPath}\n`);

  // Spawn MCP server
  const proc = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Capture stderr for debugging
  let stderr = '';
  proc.stderr!.on('data', (d: Buffer) => { stderr += d.toString(); });

  // Wait for server startup
  await new Promise((r) => setTimeout(r, 500));

  if (proc.exitCode !== null) {
    console.error(`  Server exited immediately: ${stderr}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let rpcId = 1;

  // Test 0: tools/list
  try {
    const listResp = await sendRpc(proc, rpcId++, 'tools/list');
    const toolCount = listResp.result?.tools?.length ?? 0;
    if (toolCount === 11) {
      console.log(`${PASS} tools/list — returned ${toolCount} tools`);
      passed++;
    } else {
      console.log(`${FAIL} tools/list — expected 11 tools, got ${toolCount}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`${FAIL} tools/list — ${e.message}`);
    failed++;
  }

  // Run all tool tests
  for (const test of tests) {
    try {
      const resp = await sendRpc(proc, rpcId++, 'tools/call', {
        name: test.tool,
        arguments: test.args,
      });

      const content = resp.result?.content?.[0]?.text;
      const isError = resp.result?.isError === true;
      let parsed: unknown;

      try {
        parsed = content ? JSON.parse(content) : null;
      } catch {
        parsed = content;
      }

      // Check expected outcome
      if (test.expect === 'error' && !isError) {
        console.log(`${FAIL} ${test.name}`);
        console.log(`       Expected error but got success`);
        failed++;
        continue;
      }

      if (test.expect === 'success' && isError) {
        const errMsg = typeof parsed === 'object' && parsed !== null && 'error' in parsed
          ? (parsed as any).error
          : content;
        console.log(`${FAIL} ${test.name}`);
        console.log(`       Unexpected error: ${String(errMsg).slice(0, 100)}`);
        failed++;
        continue;
      }

      // Run custom validation
      if (test.validate) {
        const validationErr = test.validate(parsed);
        if (validationErr) {
          console.log(`${FAIL} ${test.name}`);
          console.log(`       Validation: ${validationErr}`);
          failed++;
          continue;
        }
      }

      console.log(`${PASS} ${test.name}`);
      passed++;
    } catch (e: any) {
      console.log(`${FAIL} ${test.name}`);
      console.log(`       Error: ${e.message}`);
      failed++;
    }
  }

  // Summary
  const total = passed + failed;
  console.log(`\n  \x1b[1mResults: ${passed}/${total} passed\x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31m${failed} test(s) failed\x1b[0m\n`);
  } else {
    console.log(`  \x1b[32mAll tests passed!\x1b[0m\n`);
  }

  // Cleanup
  proc.kill('SIGTERM');
  process.exit(failed > 0 ? 1 : 0);
}

main();
