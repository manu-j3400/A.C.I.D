#!/usr/bin/env node
/**
 * Soteria MCP Server
 * Exposes Soteria's security scanning API as MCP tools for Ruflo agents.
 *
 * Tools:
 *   soteria_scan          — analyze a single code snippet
 *   soteria_batch_scan    — analyze multiple files in parallel
 *   soteria_security_score — get the user's aggregate security score / recent scans
 *   soteria_scan_history  — paginated scan history with optional filters
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = process.env.SOTERIA_API_URL ?? 'https://a-c-i-d-1.onrender.com';
const AUTH_TOKEN = process.env.SOTERIA_TOKEN ?? '';   // JWT from Soteria login

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) h['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  return h;
}

async function soteriaPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json() as unknown;
  if (!res.ok) throw new Error((data as any).error ?? `HTTP ${res.status}`);
  return data;
}

async function soteriaGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  const data = await res.json() as unknown;
  if (!res.ok) throw new Error((data as any).error ?? `HTTP ${res.status}`);
  return data;
}

// ── Tool schemas ──────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'soteria_scan',
    description: `Scan a code snippet for malware, supply chain attacks, and security vulnerabilities
using Soteria's ensemble of ML engines (sklearn, GCN, entropy profiler, SNN temporal profiler).

Returns: risk_level (LOW/MEDIUM/HIGH/CRITICAL), malicious_probability (0-1),
detected_language, vulnerabilities[] with CWE IDs and fix hints, engine outputs.`,
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Source code to scan',
        },
        filename: {
          type: 'string',
          description: 'Optional filename (e.g. main.py) — helps with language detection',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'soteria_batch_scan',
    description: `Scan multiple files in parallel against Soteria's detection engines.
Useful for PR reviews where multiple changed files need scanning.

Returns an array of scan results, one per file, sorted by risk_level descending.
Includes a top-level summary: highest_risk, total_threats, files_clean.`,
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: 'Array of files to scan',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              code:     { type: 'string' },
            },
            required: ['filename', 'code'],
          },
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'soteria_security_score',
    description: `Retrieve the authenticated user's aggregate security score and recent scan history.

Returns: score (0-100), grade (A-F), total_scans, threats, clean_rate, risk_distribution,
daily_trend (30 days), recent_scans (last 10).`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'soteria_scan_history',
    description: 'Retrieve paginated scan history for the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        page:  { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Results per page (default 20, max 100)' },
      },
    },
  },
];

// ── Server ────────────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'soteria-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {

      // ── soteria_scan ──────────────────────────────────────────────────────
      case 'soteria_scan': {
        const { code, filename } = args as { code: string; filename?: string };
        if (!code?.trim()) throw new McpError(ErrorCode.InvalidParams, '`code` is required');

        const result = await soteriaPost('/analyze', { code, filename }) as any;

        // Surface the most actionable fields at the top level
        const summary = {
          risk_level:           result.risk_level,
          malicious_probability: result.malicious_probability,
          is_malicious:         result.is_malicious,
          detected_language:    result.language,
          confidence:           result.confidence,
          summary:              result.summary,
          vulnerability_count:  (result.vulnerabilities ?? []).length,
          critical_count:       (result.vulnerabilities ?? []).filter((v: any) => v.severity === 'CRITICAL').length,
          high_count:           (result.vulnerabilities ?? []).filter((v: any) => v.severity === 'HIGH').length,
          vulnerabilities:      (result.vulnerabilities ?? []).map((v: any) => ({
            pattern:     v.pattern,
            severity:    v.severity,
            description: v.description,
            cwe:         v.cwe,
            fix_hint:    v.fix_hint,
            line:        v.line,
          })),
          engines: result.metadata ?? {},
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      }

      // ── soteria_batch_scan ────────────────────────────────────────────────
      case 'soteria_batch_scan': {
        const { files } = args as { files: { filename: string; code: string }[] };
        if (!files?.length) throw new McpError(ErrorCode.InvalidParams, '`files` must be a non-empty array');

        const riskRank: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

        // Scan all files in parallel
        const results = await Promise.all(
          files.map(async ({ filename, code }) => {
            try {
              const r = await soteriaPost('/analyze', { code, filename }) as any;
              return {
                filename,
                risk_level:           r.risk_level,
                malicious_probability: r.malicious_probability,
                is_malicious:         r.is_malicious,
                vulnerability_count:  (r.vulnerabilities ?? []).length,
                top_vulnerabilities:  (r.vulnerabilities ?? [])
                  .filter((v: any) => v.severity === 'CRITICAL' || v.severity === 'HIGH')
                  .slice(0, 5)
                  .map((v: any) => ({ pattern: v.pattern, severity: v.severity, cwe: v.cwe, fix_hint: v.fix_hint })),
                summary: r.summary,
                error:   null,
              };
            } catch (err: any) {
              return { filename, risk_level: 'ERROR', is_malicious: false, error: err.message };
            }
          }),
        );

        // Sort by risk descending
        results.sort((a, b) => (riskRank[b.risk_level] ?? -1) - (riskRank[a.risk_level] ?? -1));

        const highest = results[0]?.risk_level ?? 'LOW';
        const threats = results.filter(r => r.is_malicious).length;

        const batch = {
          summary: {
            files_scanned:  results.length,
            highest_risk:   highest,
            total_threats:  threats,
            files_clean:    results.length - threats,
            needs_attention: highest === 'CRITICAL' || highest === 'HIGH',
          },
          files: results,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(batch, null, 2) }],
        };
      }

      // ── soteria_security_score ────────────────────────────────────────────
      case 'soteria_security_score': {
        const data = await soteriaGet('/security-score');
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      // ── soteria_scan_history ──────────────────────────────────────────────
      case 'soteria_scan_history': {
        const { page = 1, limit = 20 } = args as { page?: number; limit?: number };
        const data = await soteriaGet(`/scan-history?page=${page}&limit=${Math.min(limit, 100)}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err: any) {
    if (err instanceof McpError) throw err;
    throw new McpError(ErrorCode.InternalError, err.message ?? 'Soteria API error');
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[soteria-mcp] Server running on stdio');
