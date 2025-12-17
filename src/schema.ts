/**
 * MCP Tool schema definition for the bullet tool
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const TOOL_DESCRIPTION = `Validate and improve bullet point lists using evidence-based cognitive research.

This tool analyzes bullet lists against scientifically-validated principles for optimal recall, scanning efficiency, and comprehension. Use it to ensure your summaries follow best practices.

WHEN TO USE:
- Before finalizing any bullet list summary
- When creating documentation, reports, or reference materials
- To score existing bullet content against research standards
- For guidance on improving list structure

KEY PRINCIPLES ENFORCED:
1. **List Length** (3-7 items, 5 optimal): Working memory limits mean more items decrease recall
2. **Hierarchy** (max 2 levels): Breadth over depth for better comprehension
3. **Serial Position**: Place critical info first and last (U-shaped recall curve)
4. **Line Length** (45-75 chars, 66 optimal): Typography research on readability
5. **Parallel Structure**: Consistent grammar enables faster scanning
6. **First Two Words**: Critical for reader fixation and scanning decisions

CONTEXT AWARENESS:
- document: Optimizes for scanning and reference (default)
- presentation: Warns that visuals may be more effective (43% more persuasive per research)
- reference: Optimizes for quick lookup

SCORING:
- 0-100 scale with letter grades (A/B/C/D/F)
- Per-rule breakdown with research citations
- Actionable improvement suggestions ranked by impact

Returns JSON with score, grade, issues, and top improvements.`;

export const BULLET_TOOL: Tool = {
  name: 'bullet',
  description: TOOL_DESCRIPTION,
  inputSchema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description:
          'Array of bullet items to validate. Each item has text and optional children for nesting.',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The bullet point text content',
            },
            children: {
              type: 'array',
              description: 'Nested sub-bullets (max 1 level recommended)',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  children: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        text: { type: 'string' },
                      },
                      required: ['text'],
                    },
                  },
                },
                required: ['text'],
              },
            },
            importance: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description:
                'Priority hint for serial position optimization. High-importance items should be first or last.',
            },
          },
          required: ['text'],
        },
      },
      context: {
        type: 'string',
        enum: ['document', 'presentation', 'reference'],
        description:
          'Usage context affects recommendations. Default: document. Use "presentation" to get warnings about bullet effectiveness in slides.',
      },
    },
    required: ['items'],
  },
};
