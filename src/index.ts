#!/usr/bin/env node

/**
 * bullet-mcp - MCP server for evidence-based bullet point summarization guidance
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { BULLET_TOOL } from './schema.js';
import { loadConfig } from './config.js';
import { BulletServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
);
const { name, version } = pkg;

// Create MCP server instance with tools capability
const server = new Server(
  {
    name,
    version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Load configuration
const config = loadConfig();

// Show configuration on startup
console.error('📝 BULLET MCP Server Starting...');
console.error(`📋 Configuration:`);
console.error(`   - Strict Mode: ${config.validation.strictMode}`);
console.error(`   - Research Citations: ${config.validation.enableResearchCitations ? 'Enabled' : 'Disabled'}`);

const bulletServer = new BulletServer(config);

// Expose tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [BULLET_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'bullet') {
    return bulletServer.analyze(request.params.arguments);
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
    isError: true,
  };
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ BULLET MCP Server running on stdio');
  console.error('📝 BULLET - Evidence-based bullet point validation');
  console.error('📚 Use "bullet" tool to analyze and improve bullet lists');

  if (config.validation.strictMode) {
    console.error('⚠️ Running in STRICT MODE - warnings treated as errors');
  }
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
