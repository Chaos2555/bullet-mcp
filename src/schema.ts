/**
 * MCP Tool schema definition for the bullet tool
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const TOOL_DESCRIPTION = `Validate and improve bullet point lists using evidence-based cognitive research.

This tool analyzes bullet lists against scientifically-validated principles for optimal recall, scanning efficiency, and comprehension. Use it to ensure your summaries follow best practices.

INPUT MODES:
- **Flat mode**: Use "items" for simple lists (3-7 items recommended)
- **Sectioned mode**: Use "sections" for long documents with multiple topics/chapters
  - Each section has its own title and items array
  - The 3-7 item rule applies PER SECTION, allowing unlimited total content

WHEN TO USE:
- Before finalizing any bullet list summary
- When creating documentation, reports, or reference materials
- To score existing bullet content against research standards
- For guidance on improving list structure

KEY PRINCIPLES ENFORCED:
1. **List Length** (3-7 items per section, 5 optimal): Working memory limits mean more items decrease recall
2. **Hierarchy** (max 2 levels): Breadth over depth for better comprehension
3. **Serial Position**: Place critical info first and last (U-shaped recall curve)
4. **Line Length** (45-75 chars, 66 optimal): Typography research on readability
5. **Parallel Structure**: Consistent grammar enables faster scanning
6. **First Two Words**: Critical for reader fixation and scanning decisions

CONTEXT AWARENESS:
- document: Optimizes for scanning and reference (default)
- presentation: Warns that visuals may be more effective (43% more persuasive per research)
- reference: Optimizes for quick lookup
- Per-section context override supported in sectioned mode

SCORING:
- 0-100 scale with letter grades (A/B/C/D/F)
- Per-rule breakdown with research citations
- Per-section breakdown in sectioned mode
- Actionable improvement suggestions ranked by impact

Returns JSON with score, grade, issues, and top improvements.`;

// Reusable item schema definition
const bulletItemSchema = {
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
};

export const BULLET_TOOL: Tool = {
  name: 'bullet',
  description: TOOL_DESCRIPTION,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title/heading for the bullet list (e.g., "Email Thread Summary")',
      },
      description: {
        type: 'string',
        description: 'Brief summary or context about what the bullets cover',
      },
      intro: {
        type: 'string',
        description: 'Introductory phrase before the bullets (e.g., "Here are the main topics:")',
      },
      items: {
        type: 'array',
        description:
          'Array of bullet items to validate (flat mode). Use this OR sections, not both.',
        items: bulletItemSchema,
      },
      sections: {
        type: 'array',
        description:
          'For long documents, group bullets into sections. Each section is validated separately. Use this OR items, not both.',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Section heading/title (e.g., "Chapter 1: Introduction")',
            },
            description: {
              type: 'string',
              description: 'Brief summary or context for this section',
            },
            intro: {
              type: 'string',
              description: 'Introductory phrase before the section bullets',
            },
            items: {
              type: 'array',
              description: 'Bullet items for this section (3-7 recommended)',
              items: bulletItemSchema,
            },
            context: {
              type: 'string',
              enum: ['document', 'presentation', 'reference'],
              description: 'Optional context override for this section',
            },
          },
          required: ['title', 'description', 'intro', 'items'],
        },
      },
      context: {
        type: 'string',
        enum: ['document', 'presentation', 'reference'],
        description:
          'Usage context affects recommendations. Default: document. In sectioned mode, this is the default context (sections can override).',
      },
    },
    required: ['title', 'description', 'intro'],
  },
};
