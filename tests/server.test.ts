import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulletServer } from '../src/server.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import type { BulletConfig, BulletItem } from '../src/types.js';

// Helper to create config
const createConfig = (overrides: Partial<BulletConfig> = {}): BulletConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
  validation: { ...DEFAULT_CONFIG.validation, ...overrides.validation },
  display: { ...DEFAULT_CONFIG.display, colorOutput: false, ...overrides.display },
});

// Helper to create items
const createItems = (count: number, textFn?: (i: number) => string): BulletItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    text: textFn ? textFn(i) : `Item ${i + 1} with enough text to be valid length`,
  }));
};

// Required fields for all inputs
const REQUIRED_FIELDS = {
  title: 'Test Title',
  description: 'Test description for the bullet list',
  intro: 'Here are the items:',
};

// Helper to create valid input with required fields
const createInput = (overrides: Record<string, unknown> = {}) => ({
  ...REQUIRED_FIELDS,
  ...overrides,
});

// Helper to create a section with required fields
const createSection = (
  title: string,
  items: BulletItem[],
  overrides: Record<string, unknown> = {}
) => ({
  title,
  description: `Description for ${title}`,
  intro: `Items in ${title}:`,
  items,
  ...overrides,
});

// Helper to parse analysis result
const parseResult = async (server: BulletServer, input: unknown) => {
  const result = await server.analyze(input);
  if (result.isError) {
    throw new Error(JSON.parse(result.content[0].text).error);
  }
  return JSON.parse(result.content[0].text);
};

describe('BulletServer', () => {
  let server: BulletServer;

  beforeEach(() => {
    server = new BulletServer(createConfig());
  });

  // ===========================================================================
  // Input Validation
  // ===========================================================================

  describe('Input Validation', () => {
    it('should reject null input', async () => {
      const result = await server.analyze(null);
      expect(result.isError).toBe(true);
    });

    it('should reject missing items', async () => {
      const result = await server.analyze({});
      expect(result.isError).toBe(true);
    });

    it('should reject empty items array', async () => {
      const result = await server.analyze({ items: [] });
      expect(result.isError).toBe(true);
    });

    it('should reject items without text', async () => {
      const result = await server.analyze({ items: [{}] });
      expect(result.isError).toBe(true);
    });

    it('should reject items with empty text', async () => {
      const result = await server.analyze({ items: [{ text: '' }] });
      expect(result.isError).toBe(true);
    });

    it('should reject items with whitespace-only text', async () => {
      const result = await server.analyze({ items: [{ text: '   ' }] });
      expect(result.isError).toBe(true);
    });

    it('should accept valid input', async () => {
      const result = await server.analyze(
        createInput({ items: [{ text: 'Valid bullet point text here' }] })
      );
      expect(result.isError).toBeUndefined();
    });
  });

  // ===========================================================================
  // List Length Validation
  // ===========================================================================

  describe('List Length Validation', () => {
    it('should give suggestion for 1 item (too sparse)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(1) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues).toHaveLength(1);
      expect(listLengthScore.issues[0].severity).toBe('suggestion');
    });

    it('should give suggestion for 2 items (below minimum)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(2) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues).toHaveLength(1);
      expect(listLengthScore.issues[0].severity).toBe('suggestion');
    });

    it('should pass for 3 items (minimum)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(3) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues).toHaveLength(0);
      expect(listLengthScore.earned_points).toBe(20);
    });

    it('should pass for 5 items (optimal)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(5) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues).toHaveLength(0);
      expect(listLengthScore.earned_points).toBe(20);
    });

    it('should pass for 7 items (max recommended)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(7) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues).toHaveLength(0);
    });

    it('should give warning for 8 items (above max)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(8) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues).toHaveLength(1);
      expect(listLengthScore.issues[0].severity).toBe('warning');
    });

    it('should give error for 10+ items (exceeds hard max)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(10) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues).toHaveLength(1);
      expect(listLengthScore.issues[0].severity).toBe('error');
      expect(listLengthScore.earned_points).toBe(0);
    });
  });

  // ===========================================================================
  // Hierarchy Validation
  // ===========================================================================

  describe('Hierarchy Validation', () => {
    it('should pass for flat list (depth 1)', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(5) }));
      const hierarchyScore = analysis.scores.find((s: any) => s.rule === 'HIERARCHY');
      expect(hierarchyScore.issues).toHaveLength(0);
      expect(hierarchyScore.earned_points).toBe(15);
    });

    it('should pass for 2 levels of nesting', async () => {
      const items = [
        {
          text: 'Parent item with valid length for testing',
          children: [{ text: 'Child item with valid length for testing' }],
        },
        { text: 'Another parent item with valid length' },
        { text: 'Third parent item with valid length here' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const hierarchyScore = analysis.scores.find((s: any) => s.rule === 'HIERARCHY');
      expect(hierarchyScore.issues).toHaveLength(0);
    });

    it('should give warning for 3 levels of nesting', async () => {
      const items = [
        {
          text: 'Level 1 parent item with valid length',
          children: [
            {
              text: 'Level 2 child item with valid length',
              children: [{ text: 'Level 3 grandchild item here' }],
            },
          ],
        },
        { text: 'Another item with valid length for test' },
        { text: 'Third item with valid length for testing' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const hierarchyScore = analysis.scores.find((s: any) => s.rule === 'HIERARCHY');
      expect(hierarchyScore.issues).toHaveLength(1);
      expect(hierarchyScore.issues[0].severity).toBe('warning');
    });

    it('should give error for 4+ levels of nesting', async () => {
      const items = [
        {
          text: 'Level 1 with valid length for testing',
          children: [
            {
              text: 'Level 2 with valid length for testing',
              children: [
                {
                  text: 'Level 3 with valid length for test',
                  children: [{ text: 'Level 4 too deep now' }],
                },
              ],
            },
          ],
        },
        { text: 'Another item with valid length for test' },
        { text: 'Third item with valid length for testing' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const hierarchyScore = analysis.scores.find((s: any) => s.rule === 'HIERARCHY');
      expect(hierarchyScore.issues).toHaveLength(1);
      expect(hierarchyScore.issues[0].severity).toBe('error');
      expect(hierarchyScore.earned_points).toBe(0);
    });
  });

  // ===========================================================================
  // Line Length Validation
  // ===========================================================================

  describe('Line Length Validation', () => {
    it('should give suggestion for short text (< 40 chars)', async () => {
      const items = [
        { text: 'Short text here' }, // 15 chars
        { text: 'Another short one' }, // 17 chars
        { text: 'Third short item' }, // 16 chars
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const lineLengthScore = analysis.scores.find((s: any) => s.rule === 'LINE_LENGTH');
      expect(lineLengthScore.issues.length).toBeGreaterThan(0);
      expect(lineLengthScore.issues[0].severity).toBe('suggestion');
    });

    it('should pass for optimal length (45-75 chars)', async () => {
      const items = [
        { text: 'This is a bullet point with optimal length for reading' }, // 55 chars
        { text: 'Another bullet point that falls within the ideal range' }, // 55 chars
        { text: 'Third bullet point also in the optimal character range' }, // 55 chars
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const lineLengthScore = analysis.scores.find((s: any) => s.rule === 'LINE_LENGTH');
      expect(lineLengthScore.issues).toHaveLength(0);
      expect(lineLengthScore.earned_points).toBe(15);
    });

    it('should give warning for very long text (> 80 chars)', async () => {
      const items = [
        {
          text: 'This is an extremely long bullet point that exceeds the recommended maximum character limit and should trigger a warning',
        },
        { text: 'Normal length bullet point for comparison here' },
        { text: 'Another normal length bullet point for test' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const lineLengthScore = analysis.scores.find((s: any) => s.rule === 'LINE_LENGTH');
      expect(lineLengthScore.issues.length).toBeGreaterThan(0);
      expect(lineLengthScore.issues[0].severity).toBe('warning');
    });
  });

  // ===========================================================================
  // Serial Position Validation
  // ===========================================================================

  describe('Serial Position Validation', () => {
    it('should pass when high importance item is first', async () => {
      const items = [
        { text: 'Critical item that must be remembered first', importance: 'high' as const },
        { text: 'Second item with normal importance level' },
        { text: 'Third item with normal importance level' },
        { text: 'Fourth item with normal importance level' },
        { text: 'Fifth item with normal importance level here' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const positionScore = analysis.scores.find((s: any) => s.rule === 'SERIAL_POSITION');
      const warnings = positionScore.issues.filter((i: any) => i.severity === 'warning');
      expect(warnings).toHaveLength(0);
    });

    it('should pass when high importance item is last', async () => {
      const items = [
        { text: 'First item with normal importance level' },
        { text: 'Second item with normal importance level' },
        { text: 'Third item with normal importance level' },
        { text: 'Fourth item with normal importance level' },
        { text: 'Critical item that must be remembered', importance: 'high' as const },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const positionScore = analysis.scores.find((s: any) => s.rule === 'SERIAL_POSITION');
      const warnings = positionScore.issues.filter((i: any) => i.severity === 'warning');
      expect(warnings).toHaveLength(0);
    });

    it('should warn when high importance item is in middle (recall valley)', async () => {
      const items = [
        { text: 'First item with normal importance level' },
        { text: 'Second item with normal importance level' },
        { text: 'Critical item buried in the middle', importance: 'high' as const },
        { text: 'Fourth item with normal importance level' },
        { text: 'Fifth item with normal importance level' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const positionScore = analysis.scores.find((s: any) => s.rule === 'SERIAL_POSITION');
      const warnings = positionScore.issues.filter((i: any) => i.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Parallel Structure Validation
  // ===========================================================================

  describe('Parallel Structure Validation', () => {
    it('should pass for all verb-imperative pattern', async () => {
      const items = [
        { text: 'Use consistent grammar throughout the list' },
        { text: 'Create parallel structure for scanning' },
        { text: 'Maintain readability with similar forms' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const structureScore = analysis.scores.find((s: any) => s.rule === 'STRUCTURE');
      expect(structureScore.issues).toHaveLength(0);
      expect(structureScore.earned_points).toBe(20);
    });

    it('should pass for all verb-gerund pattern', async () => {
      const items = [
        { text: 'Using consistent grammar throughout the list' },
        { text: 'Creating parallel structure for better scanning' },
        { text: 'Maintaining readability with similar forms' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const structureScore = analysis.scores.find((s: any) => s.rule === 'STRUCTURE');
      expect(structureScore.issues).toHaveLength(0);
    });

    it('should warn for mixed patterns', async () => {
      const items = [
        { text: 'Use consistent grammar throughout the list' }, // imperative
        { text: 'Creating parallel structure for scanning' }, // gerund
        { text: 'The readability is improved with forms' }, // noun-phrase
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const structureScore = analysis.scores.find((s: any) => s.rule === 'STRUCTURE');
      expect(structureScore.issues.length).toBeGreaterThan(0);
    });

    it('should skip check for single item', async () => {
      const items = [{ text: 'Single item does not need parallel check' }];
      const analysis = await parseResult(server, createInput({ items }));
      const structureScore = analysis.scores.find((s: any) => s.rule === 'STRUCTURE');
      expect(structureScore.issues).toHaveLength(0);
      expect(structureScore.earned_points).toBe(20);
    });
  });

  // ===========================================================================
  // First Words Validation
  // ===========================================================================

  describe('First Words Validation', () => {
    it('should pass for unique first words', async () => {
      const items = [
        { text: 'Use consistent grammar throughout the list' },
        { text: 'Create parallel structure for scanning' },
        { text: 'Maintain readability with similar forms' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const firstWordsScore = analysis.scores.find((s: any) => s.rule === 'FIRST_WORDS');
      expect(firstWordsScore.issues).toHaveLength(0);
      expect(firstWordsScore.earned_points).toBe(10);
    });

    it('should warn for duplicate first words', async () => {
      const items = [
        { text: 'Use consistent grammar throughout the list' },
        { text: 'Use consistent structure for better scanning' }, // Same first 2 words
        { text: 'Maintain readability with similar text forms' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const firstWordsScore = analysis.scores.find((s: any) => s.rule === 'FIRST_WORDS');
      expect(firstWordsScore.issues.length).toBeGreaterThan(0);
      expect(firstWordsScore.issues[0].severity).toBe('warning');
    });

    it('should be case-insensitive', async () => {
      const items = [
        { text: 'Use consistent grammar throughout the list' },
        { text: 'use consistent structure for better scanning' }, // Same first 2 words, different case
        { text: 'Maintain readability with similar text forms' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const firstWordsScore = analysis.scores.find((s: any) => s.rule === 'FIRST_WORDS');
      expect(firstWordsScore.issues.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Formatting Validation
  // ===========================================================================

  describe('Formatting Validation', () => {
    it('should pass for consistent punctuation', async () => {
      const items = [
        { text: 'First item ends with a period.' },
        { text: 'Second item also ends with period.' },
        { text: 'Third item follows the same pattern.' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const formattingScore = analysis.scores.find((s: any) => s.rule === 'FORMATTING');
      const punctuationIssues = formattingScore.issues.filter((i: any) =>
        i.message.includes('punctuation')
      );
      expect(punctuationIssues).toHaveLength(0);
    });

    it('should suggest for inconsistent punctuation', async () => {
      const items = [
        { text: 'First item ends with a period.' },
        { text: 'Second item has no period' },
        { text: 'Third item also has period.' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const formattingScore = analysis.scores.find((s: any) => s.rule === 'FORMATTING');
      const punctuationIssues = formattingScore.issues.filter((i: any) =>
        i.message.includes('punctuation')
      );
      expect(punctuationIssues.length).toBeGreaterThan(0);
    });

    it('should pass for consistent capitalization', async () => {
      const items = [
        { text: 'First item starts with capital letter' },
        { text: 'Second item also starts with capital' },
        { text: 'Third item follows the same pattern' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const formattingScore = analysis.scores.find((s: any) => s.rule === 'FORMATTING');
      const capIssues = formattingScore.issues.filter((i: any) =>
        i.message.includes('capitalization')
      );
      expect(capIssues).toHaveLength(0);
    });

    it('should suggest for inconsistent capitalization', async () => {
      const items = [
        { text: 'First item starts with capital letter' },
        { text: 'second item starts with lowercase here' },
        { text: 'Third item starts with capital again' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      const formattingScore = analysis.scores.find((s: any) => s.rule === 'FORMATTING');
      const capIssues = formattingScore.issues.filter((i: any) =>
        i.message.includes('capitalization')
      );
      expect(capIssues.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Context Analysis
  // ===========================================================================

  describe('Context Analysis', () => {
    it('should give excellent fit for document context', async () => {
      const analysis = await parseResult(
        server,
        createInput({ items: createItems(5), context: 'document' })
      );
      expect(analysis.context_fit).toBe('excellent');
    });

    it('should give poor fit for presentation context', async () => {
      const analysis = await parseResult(
        server,
        createInput({ items: createItems(5), context: 'presentation' })
      );
      expect(analysis.context_fit).toBe('poor');
      expect(analysis.context_feedback).toContain('visuals');
    });
  });

  // ===========================================================================
  // Grade Calculation
  // ===========================================================================

  describe('Grade Calculation', () => {
    it('should give A grade for score >= 90', async () => {
      const items = [
        { text: 'Use consistent grammar throughout the list items' },
        { text: 'Create parallel structure for better scanning' },
        { text: 'Maintain good readability with similar forms' },
        { text: 'Follow research-based formatting guidelines' },
        { text: 'Apply evidence-based design principles here' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      expect(analysis.overall_score).toBeGreaterThanOrEqual(90);
      expect(analysis.grade).toBe('A');
    });

    it('should give lower grade for many issues', async () => {
      // 12 items with short text, mixed patterns = multiple penalties
      const items = [
        { text: 'Short one' },
        { text: 'short two' }, // inconsistent cap
        { text: 'Using three' }, // different pattern
        { text: 'Short four' },
        { text: 'The fifth item here' }, // different pattern
        { text: 'short six' },
        { text: 'Short seven' },
        { text: 'short eight' },
        { text: 'Short nine' },
        { text: 'short ten' },
        { text: 'Short eleven' },
        { text: 'short twelve' },
      ];
      const analysis = await parseResult(server, createInput({ items }));
      // With 12 items (error), short text, mixed patterns, inconsistent caps
      // Score should be significantly reduced
      expect(analysis.errors.length).toBeGreaterThan(0);
      expect(analysis.grade).not.toBe('A');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle unicode and emoji gracefully', async () => {
      const items = [
        { text: '使用一致的语法贯穿整个列表项目内容' },
        { text: 'Create parallel structure for scanning' },
        { text: '📝 Emoji at the start of this bullet point' },
      ];
      const result = await server.analyze(createInput({ items }));
      expect(result.isError).toBeUndefined();
    });

    it('should handle very long text', async () => {
      const longText = 'A'.repeat(500);
      const items = [
        { text: longText },
        { text: 'Normal length bullet point for comparison' },
        { text: 'Another normal length bullet point here' },
      ];
      const result = await server.analyze(createInput({ items }));
      expect(result.isError).toBeUndefined();
      const analysis = JSON.parse(result.content[0].text);
      expect(analysis.warnings.length).toBeGreaterThan(0);
    });

    it('should handle null children gracefully', async () => {
      const items = [
        { text: 'Item with null children', children: null as any },
        { text: 'Item with undefined children', children: undefined },
        { text: 'Normal item without children property' },
      ];
      const result = await server.analyze(createInput({ items }));
      expect(result.isError).toBeUndefined();
    });
  });

  // ===========================================================================
  // Strict Mode
  // ===========================================================================

  describe('Strict Mode', () => {
    it('should treat warnings as errors when strictMode is enabled', async () => {
      const strictServer = new BulletServer(
        createConfig({ validation: { strictMode: true, enableResearchCitations: true } })
      );
      // 8 items triggers a warning (above 7 max recommended)
      const items = createItems(8);
      const analysis = await parseResult(strictServer, createInput({ items }));

      // Warning should be promoted to error
      expect(analysis.errors.length).toBeGreaterThan(0);
      expect(analysis.warnings).toHaveLength(0);
      // The promoted error should have severity 'error'
      expect(analysis.errors.some((e: any) => e.rule === 'LIST_LENGTH')).toBe(true);
    });

    it('should keep warnings as warnings when strictMode is disabled', async () => {
      // 8 items triggers a warning
      const items = createItems(8);
      const analysis = await parseResult(server, createInput({ items }));

      expect(analysis.warnings.length).toBeGreaterThan(0);
      expect(analysis.warnings.some((w: any) => w.rule === 'LIST_LENGTH')).toBe(true);
    });
  });

  // ===========================================================================
  // Research Citations
  // ===========================================================================

  describe('Research Citations', () => {
    it('should include research citations by default', async () => {
      const analysis = await parseResult(server, createInput({ items: createItems(10) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues[0].research_basis).toBeDefined();
      expect(listLengthScore.issues[0].research_basis).toContain('Miller');
    });

    it('should exclude research citations when disabled', async () => {
      const serverNoCitations = new BulletServer(
        createConfig({ validation: { strictMode: false, enableResearchCitations: false } })
      );
      const analysis = await parseResult(serverNoCitations, createInput({ items: createItems(10) }));
      const listLengthScore = analysis.scores.find((s: any) => s.rule === 'LIST_LENGTH');
      expect(listLengthScore.issues[0].research_basis).toBeUndefined();
    });
  });

  // ===========================================================================
  // Sections Mode
  // ===========================================================================

  describe('Sections Mode', () => {
    describe('Input Validation', () => {
      it('should reject both items and sections together', async () => {
        const result = await server.analyze(
          createInput({
            items: [{ text: 'An item here' }],
            sections: [createSection('Section 1', [{ text: 'An item here' }])],
          })
        );
        expect(result.isError).toBe(true);
        const error = JSON.parse(result.content[0].text);
        expect(error.error).toContain('Cannot use both');
      });

      it('should reject empty sections array', async () => {
        const result = await server.analyze({ sections: [] });
        expect(result.isError).toBe(true);
      });

      it('should reject section without title', async () => {
        const result = await server.analyze({
          sections: [{ items: [{ text: 'An item here' }] }],
        });
        expect(result.isError).toBe(true);
      });

      it('should reject section with empty title', async () => {
        const result = await server.analyze({
          sections: [{ title: '', items: [{ text: 'An item here' }] }],
        });
        expect(result.isError).toBe(true);
      });

      it('should reject section without items', async () => {
        const result = await server.analyze({
          sections: [{ title: 'Section 1' }],
        });
        expect(result.isError).toBe(true);
      });

      it('should reject section with empty items array', async () => {
        const result = await server.analyze({
          sections: [{ title: 'Section 1', items: [] }],
        });
        expect(result.isError).toBe(true);
      });

      it('should accept valid sections input', async () => {
        const result = await server.analyze(
          createInput({
            sections: [
              createSection('Chapter 1', [
                { text: 'First point with good length for reading' },
                { text: 'Second point with good length for reading' },
                { text: 'Third point with good length for reading' },
              ]),
            ],
          })
        );
        expect(result.isError).toBeUndefined();
      });
    });

    describe('Basic Sections Analysis', () => {
      it('should analyze multiple sections', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Introduction', [
                { text: 'Use consistent grammar throughout the section' },
                { text: 'Create parallel structure for better scanning' },
                { text: 'Maintain readability with similar text forms' },
              ]),
              createSection('Methods', [
                { text: 'Apply research-based formatting guidelines' },
                { text: 'Follow evidence-based design principles here' },
                { text: 'Implement structured content approaches now' },
              ]),
            ],
          })
        );

        // Should have section_scores
        expect(analysis.section_scores).toBeDefined();
        expect(analysis.section_scores).toHaveLength(2);
        expect(analysis.section_scores[0].title).toBe('Introduction');
        expect(analysis.section_scores[1].title).toBe('Methods');
      });

      it('should calculate overall score as average of sections', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Good Section', [
                { text: 'Use consistent grammar throughout the section' },
                { text: 'Create parallel structure for better scanning' },
                { text: 'Maintain readability with similar text forms' },
              ]),
              createSection('Another Good Section', [
                { text: 'Apply research-based formatting guidelines' },
                { text: 'Follow evidence-based design principles here' },
                { text: 'Implement structured content approaches now' },
              ]),
            ],
          })
        );

        // Both sections should score well
        expect(analysis.section_scores[0].score).toBeGreaterThanOrEqual(80);
        expect(analysis.section_scores[1].score).toBeGreaterThanOrEqual(80);
        // Overall should be average
        expect(analysis.overall_score).toBeGreaterThanOrEqual(80);
      });

      it('should include total item_count across all sections', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Section 1', [
                { text: 'Point one with enough text for validity' },
                { text: 'Point two with enough text for validity' },
                { text: 'Point three with enough text for validity' },
              ]),
              createSection('Section 2', [
                { text: 'Point four with enough text for validity' },
                { text: 'Point five with enough text for validity' },
              ]),
            ],
          })
        );

        expect(analysis.item_count).toBe(5); // 3 + 2
      });
    });

    describe('Per-Section Validation', () => {
      it('should apply 3-7 rule per section, not globally', async () => {
        // 10 items total, but split across 2 sections (5 each) - should pass
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Section 1', createItems(5)),
              createSection('Section 2', createItems(5)),
            ],
          })
        );

        // No error for list length since each section has 5 items
        const listLengthErrors = analysis.errors.filter((e: any) => e.rule === 'LIST_LENGTH');
        expect(listLengthErrors).toHaveLength(0);
      });

      it('should error when a single section has too many items', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Good Section', createItems(5)),
              createSection('Overloaded Section', createItems(12)), // Too many
            ],
          })
        );

        // Should have error from the overloaded section
        const listLengthErrors = analysis.errors.filter((e: any) => e.rule === 'LIST_LENGTH');
        expect(listLengthErrors.length).toBeGreaterThan(0);
        expect(listLengthErrors[0].message).toContain('Overloaded Section');
      });

      it('should prefix issues with section title', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [createSection('My Section', createItems(12))], // Will trigger error
          })
        );

        expect(analysis.errors[0].message).toContain('[My Section]');
      });
    });

    describe('Section Context Override', () => {
      it('should use global context by default', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [createSection('Section 1', createItems(5))],
            context: 'presentation',
          })
        );

        // Section should inherit global context
        expect(analysis.section_scores[0].context).toBe('presentation');
        expect(analysis.context_fit).toBe('poor'); // presentation context
      });

      it('should allow per-section context override', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Document Section', createItems(5), { context: 'document' }),
              createSection('Presentation Section', createItems(5), { context: 'presentation' }),
            ],
            context: 'reference', // Global default
          })
        );

        expect(analysis.section_scores[0].context).toBe('document');
        expect(analysis.section_scores[1].context).toBe('presentation');
      });
    });

    describe('Section Scores', () => {
      it('should include per-section score breakdown', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Well Formed Section', [
                { text: 'Use consistent grammar throughout the section' },
                { text: 'Create parallel structure for better scanning' },
                { text: 'Maintain readability with similar text forms' },
              ]),
              createSection('Problematic Section', [
                { text: 'short' },
                { text: 'SHORT TWO' }, // inconsistent
                { text: 'using gerund here instead of imperative' },
              ]),
            ],
          })
        );

        // First section should score higher
        expect(analysis.section_scores[0].score).toBeGreaterThan(
          analysis.section_scores[1].score
        );
        expect(analysis.section_scores[1].issues.length).toBeGreaterThan(0);
      });

      it('should include grade per section', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Good Section', [
                { text: 'Use consistent grammar throughout the section' },
                { text: 'Create parallel structure for better scanning' },
                { text: 'Maintain readability with similar text forms' },
              ]),
            ],
          })
        );

        expect(analysis.section_scores[0].grade).toBeDefined();
        expect(['A', 'B', 'C', 'D', 'F']).toContain(analysis.section_scores[0].grade);
      });
    });

    describe('Sectioned Summary', () => {
      it('should generate sectioned summary', async () => {
        const analysis = await parseResult(
          server,
          createInput({
            sections: [
              createSection('Section A', createItems(5)),
              createSection('Section B', createItems(5)),
            ],
          })
        );

        expect(analysis.summary).toContain('sections');
      });
    });
  });
});
