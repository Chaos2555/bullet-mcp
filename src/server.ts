/**
 * BulletServer - Core validation logic for bullet point analysis
 */

import type {
  BulletAnalysis,
  BulletConfig,
  BulletInput,
  BulletItem,
  BulletSection,
  Context,
  ContextFit,
  Grade,
  RuleScore,
  SectionScore,
  Severity,
  StructuredBulletList,
  ValidationIssue,
} from './types.js';

import {
  FIRST_WORDS,
  FORMATTING,
  GRADES,
  HIERARCHY,
  LINE_LENGTH,
  LIST_LENGTH,
  RESEARCH_CITATIONS,
  SERIAL_POSITION,
  STRUCTURE,
  TOTAL_POINTS,
} from './constants.js';

/**
 * Pattern types for parallel structure detection
 */
type GrammarPattern =
  | 'verb-imperative'
  | 'verb-gerund'
  | 'noun-phrase'
  | 'sentence'
  | 'unknown';

/**
 * Common imperative verbs for pattern detection
 */
const IMPERATIVE_VERBS = new Set([
  'use',
  'create',
  'add',
  'remove',
  'update',
  'check',
  'ensure',
  'make',
  'set',
  'get',
  'run',
  'build',
  'test',
  'deploy',
  'configure',
  'install',
  'enable',
  'disable',
  'implement',
  'define',
  'write',
  'read',
  'delete',
  'move',
  'copy',
  'start',
  'stop',
  'open',
  'close',
  'send',
  'receive',
  'validate',
  'verify',
  'confirm',
  'select',
  'choose',
  'avoid',
  'include',
  'exclude',
  'maintain',
  'keep',
  'place',
  'put',
  'apply',
  'follow',
  'consider',
  'review',
  'analyze',
  'optimize',
  'limit',
  'maximize',
  'minimize',
  'target',
  'focus',
  'provide',
  'support',
  'handle',
  'process',
  'format',
  'parse',
  'convert',
  'transform',
  'organize',
  'structure',
  'break',
  'split',
  'merge',
  'combine',
  'group',
  'separate',
  'allow',
  'prevent',
  'require',
  'expect',
  'return',
  'call',
  'invoke',
  'execute',
  'perform',
  'complete',
  'finish',
  'begin',
  'continue',
  'repeat',
  'iterate',
  'loop',
  'track',
  'monitor',
  'log',
  'record',
  'store',
  'save',
  'load',
  'fetch',
  'retrieve',
  'display',
  'show',
  'hide',
  'render',
  'print',
  'export',
  'import',
]);

export class BulletServer {
  private config: BulletConfig;

  constructor(config: BulletConfig) {
    this.config = config;
  }

  /**
   * Main entry point - analyze bullet items and return structured feedback
   */
  public async analyze(input: unknown): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    try {
      const bulletInput = this.validateInput(input);
      const globalContext: Context = bulletInput.context || 'document';

      // Detect mode: flat (items) vs sectioned (sections)
      if (bulletInput.sections && bulletInput.sections.length > 0) {
        return this.analyzeSections(
          bulletInput.sections,
          globalContext,
          bulletInput.title,
          bulletInput.description,
          bulletInput.intro
        );
      }

      // Flat mode - original behavior
      return this.analyzeFlat(
        bulletInput.items!,
        globalContext,
        bulletInput.title,
        bulletInput.description,
        bulletInput.intro
      );
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
                hint: 'Provide "items" (flat mode) or "sections" (sectioned mode). Each item: {text: string, children?: [...], importance?: "high"|"medium"|"low"}',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Analyze flat bullet list (original mode)
   */
  private analyzeFlat(
    items: BulletItem[],
    context: Context,
    title?: string,
    description?: string,
    intro?: string
  ): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    // Run all validators
    const scores: RuleScore[] = [
      this.validateListLength(items),
      this.validateHierarchy(items),
      this.validateLineLength(items),
      this.validateSerialPosition(items),
      this.validateStructure(items),
      this.validateFirstWords(items),
      this.validateFormatting(items),
    ];

    // Calculate overall score
    const totalEarned = scores.reduce((sum, s) => sum + s.earned_points, 0);
    const overallScore = Math.round((totalEarned / TOTAL_POINTS) * 100);

    // Determine grade
    const grade = this.calculateGrade(overallScore);

    // Aggregate issues by severity
    const allIssues = scores.flatMap((s) => s.issues);
    let errors = allIssues.filter((i) => i.severity === 'error');
    let warnings = allIssues.filter((i) => i.severity === 'warning');
    const suggestions = allIssues.filter((i) => i.severity === 'suggestion');

    if (this.config.validation.strictMode) {
      errors = [...errors, ...warnings.map((w) => ({ ...w, severity: 'error' as const }))];
      warnings = [];
    }

    // Context analysis
    const contextAnalysis = this.analyzeContext(items, context);

    // Build analysis result
    const analysis: BulletAnalysis = {
      ...(title && { title }),
      ...(description && { description }),
      ...(intro && { intro }),
      overall_score: overallScore,
      grade,
      scores: this.config.validation.enableResearchCitations
        ? scores
        : scores.map((s) => ({
            ...s,
            issues: s.issues.map((i) => {
              const { research_basis, ...rest } = i;
              return rest;
            }),
          })),
      errors,
      warnings,
      suggestions,
      summary: this.generateSummary(overallScore, errors.length, warnings.length),
      top_improvements: this.getTopImprovements(allIssues, overallScore),
      item_count: items.length,
      max_depth: this.calculateMaxDepth(items),
      avg_line_length: this.calculateAvgLineLength(items),
      context_fit: contextAnalysis.fit,
      context_feedback: contextAnalysis.feedback,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
    };
  }

  /**
   * Analyze sectioned bullet lists (new mode for long documents)
   */
  private analyzeSections(
    sections: BulletSection[],
    globalContext: Context,
    title?: string,
    description?: string,
    intro?: string
  ): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    const sectionScores: SectionScore[] = [];
    const allRuleScores: RuleScore[] = [];
    let totalItems = 0;
    let allMaxDepth = 1;
    const allLengths: number[] = [];

    // Aggregate all issues
    let allErrors: ValidationIssue[] = [];
    let allWarnings: ValidationIssue[] = [];
    let allSuggestions: ValidationIssue[] = [];

    // Analyze each section
    for (const section of sections) {
      const sectionContext = section.context || globalContext;

      // Run validators for this section
      const scores: RuleScore[] = [
        this.validateListLength(section.items),
        this.validateHierarchy(section.items),
        this.validateLineLength(section.items),
        this.validateSerialPosition(section.items),
        this.validateStructure(section.items),
        this.validateFirstWords(section.items),
        this.validateFormatting(section.items),
      ];

      // Add section prefix to issue messages
      const prefixedScores = scores.map((score) => ({
        ...score,
        issues: score.issues.map((issue) => ({
          ...issue,
          message: `[${section.title}] ${issue.message}`,
        })),
      }));

      allRuleScores.push(...prefixedScores);

      // Calculate section score
      const totalEarned = scores.reduce((sum, s) => sum + s.earned_points, 0);
      const sectionScore = Math.round((totalEarned / TOTAL_POINTS) * 100);
      const sectionGrade = this.calculateGrade(sectionScore);

      // Aggregate section issues
      const sectionIssues = prefixedScores.flatMap((s) => s.issues);

      sectionScores.push({
        title: section.title,
        ...(section.description && { description: section.description }),
        ...(section.intro && { intro: section.intro }),
        score: sectionScore,
        grade: sectionGrade,
        item_count: section.items.length,
        issues: sectionIssues,
        context: sectionContext,
      });

      // Collect for overall aggregation
      totalItems += section.items.length;
      allMaxDepth = Math.max(allMaxDepth, this.calculateMaxDepth(section.items));
      this.collectLengths(section.items, allLengths);

      // Aggregate issues by severity
      allErrors.push(...sectionIssues.filter((i) => i.severity === 'error'));
      allWarnings.push(...sectionIssues.filter((i) => i.severity === 'warning'));
      allSuggestions.push(...sectionIssues.filter((i) => i.severity === 'suggestion'));
    }

    // Apply strict mode if enabled
    if (this.config.validation.strictMode) {
      allErrors = [...allErrors, ...allWarnings.map((w) => ({ ...w, severity: 'error' as const }))];
      allWarnings = [];
    }

    // Calculate overall score (average of section scores)
    const overallScore = Math.round(
      sectionScores.reduce((sum, s) => sum + s.score, 0) / sectionScores.length
    );
    const grade = this.calculateGrade(overallScore);

    // Aggregate rule scores by rule
    const aggregatedScores = this.aggregateRuleScores(allRuleScores);

    // Context analysis for the dominant context
    const contextAnalysis = this.analyzeContext(
      sections.flatMap((s) => s.items),
      globalContext
    );

    // Build analysis result
    const analysis: BulletAnalysis = {
      ...(title && { title }),
      ...(description && { description }),
      ...(intro && { intro }),
      overall_score: overallScore,
      grade,
      scores: this.config.validation.enableResearchCitations
        ? aggregatedScores
        : aggregatedScores.map((s) => ({
            ...s,
            issues: s.issues.map((i) => {
              const { research_basis, ...rest } = i;
              return rest;
            }),
          })),
      errors: allErrors,
      warnings: allWarnings,
      suggestions: allSuggestions,
      summary: this.generateSectionedSummary(overallScore, sections.length, sectionScores),
      top_improvements: this.getTopImprovements([...allErrors, ...allWarnings, ...allSuggestions], overallScore),
      item_count: totalItems,
      max_depth: allMaxDepth,
      avg_line_length: allLengths.length > 0 ? Math.round(allLengths.reduce((a, b) => a + b, 0) / allLengths.length) : 0,
      context_fit: contextAnalysis.fit,
      context_feedback: contextAnalysis.feedback,
      section_scores: sectionScores,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
    };
  }

  /**
   * Collect text lengths from items recursively
   */
  private collectLengths(items: BulletItem[], lengths: number[]): void {
    for (const item of items) {
      lengths.push(item.text.length);
      if (item.children) {
        this.collectLengths(item.children, lengths);
      }
    }
  }

  /**
   * Aggregate rule scores from multiple sections
   */
  private aggregateRuleScores(allScores: RuleScore[]): RuleScore[] {
    const byRule = new Map<string, RuleScore[]>();

    for (const score of allScores) {
      if (!byRule.has(score.rule)) {
        byRule.set(score.rule, []);
      }
      byRule.get(score.rule)!.push(score);
    }

    const aggregated: RuleScore[] = [];
    for (const [rule, scores] of byRule) {
      const totalMax = scores.reduce((sum, s) => sum + s.max_points, 0);
      const totalEarned = scores.reduce((sum, s) => sum + s.earned_points, 0);
      const allIssues = scores.flatMap((s) => s.issues);

      aggregated.push({
        rule,
        max_points: Math.round(totalMax / scores.length), // Average max per section
        earned_points: Math.round(totalEarned / scores.length), // Average earned per section
        issues: allIssues,
      });
    }

    return aggregated;
  }

  /**
   * Generate summary for sectioned analysis
   */
  private generateSectionedSummary(
    overallScore: number,
    sectionCount: number,
    sectionScores: SectionScore[]
  ): string {
    const bestSection = sectionScores.reduce((best, s) => (s.score > best.score ? s : best));
    const worstSection = sectionScores.reduce((worst, s) => (s.score < worst.score ? s : worst));

    if (overallScore >= 90) {
      return `Excellent structured summary across ${sectionCount} sections. All sections follow evidence-based best practices.`;
    } else if (overallScore >= 80) {
      return `Good structured summary across ${sectionCount} sections. Best: "${bestSection.title}" (${bestSection.score}), needs work: "${worstSection.title}" (${worstSection.score}).`;
    } else {
      return `Structured summary with ${sectionCount} sections needs improvement. Focus on "${worstSection.title}" (score: ${worstSection.score}).`;
    }
  }

  /**
   * Validate and parse input
   */
  private validateInput(input: unknown): BulletInput {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object');
    }

    const obj = input as Record<string, unknown>;

    // Check for either items or sections (but not both)
    const hasItems = obj.items && Array.isArray(obj.items);
    const hasSections = obj.sections && Array.isArray(obj.sections);

    if (!hasItems && !hasSections) {
      throw new Error('Must provide either "items" (flat mode) or "sections" (sectioned mode)');
    }

    if (hasItems && hasSections) {
      throw new Error('Cannot use both "items" and "sections" - choose one mode');
    }

    if (hasItems) {
      // Flat mode validation
      if ((obj.items as unknown[]).length === 0) {
        throw new Error('Items array cannot be empty');
      }
      this.validateItemsArray(obj.items as unknown[], 'items');
    }

    if (hasSections) {
      // Sectioned mode validation
      const sections = obj.sections as unknown[];
      if (sections.length === 0) {
        throw new Error('Sections array cannot be empty');
      }

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as Record<string, unknown>;
        if (!section || typeof section !== 'object') {
          throw new Error(`Section at index ${i} must be an object`);
        }
        if (typeof section.title !== 'string' || section.title.trim().length === 0) {
          throw new Error(`Section at index ${i} must have a non-empty title`);
        }
        if (!section.items || !Array.isArray(section.items)) {
          throw new Error(`Section "${section.title}" must have an items array`);
        }
        if ((section.items as unknown[]).length === 0) {
          throw new Error(`Section "${section.title}" cannot have empty items array`);
        }
        this.validateItemsArray(section.items as unknown[], `section "${section.title}"`);
      }
    }

    return obj as unknown as BulletInput;
  }

  /**
   * Validate an array of bullet items
   */
  private validateItemsArray(items: unknown[], location: string): void {
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      if (!item || typeof item !== 'object') {
        throw new Error(`Item at index ${i} in ${location} must be an object`);
      }
      if (typeof item.text !== 'string' || item.text.trim().length === 0) {
        throw new Error(`Item at index ${i} in ${location} must have non-empty text property`);
      }
    }
  }

  // ===========================================================================
  // Validators
  // ===========================================================================

  /**
   * Validate list length against working memory research
   */
  private validateListLength(items: BulletItem[]): RuleScore {
    const count = items.length;
    const issues: ValidationIssue[] = [];
    let points: number = LIST_LENGTH.POINTS;

    if (count > LIST_LENGTH.HARD_MAX_ITEMS) {
      issues.push({
        rule: 'LIST_LENGTH',
        severity: 'error',
        message: `List has ${count} items, exceeds maximum of ${LIST_LENGTH.HARD_MAX_ITEMS}`,
        suggestion: `Subdivide into ${Math.ceil(count / LIST_LENGTH.OPTIMAL_ITEMS)} categorized groups of ~${LIST_LENGTH.OPTIMAL_ITEMS} items each`,
        research_basis: RESEARCH_CITATIONS.LIST_LENGTH,
      });
      points = 0;
    } else if (count > LIST_LENGTH.MAX_ITEMS) {
      issues.push({
        rule: 'LIST_LENGTH',
        severity: 'warning',
        message: `List has ${count} items, exceeds recommended maximum of ${LIST_LENGTH.MAX_ITEMS}`,
        suggestion: 'Consider subdividing or removing less critical items',
        research_basis: RESEARCH_CITATIONS.LIST_LENGTH,
      });
      points = Math.max(0, points - 10);
    } else if (count < LIST_LENGTH.MIN_ITEMS) {
      issues.push({
        rule: 'LIST_LENGTH',
        severity: 'suggestion',
        message: `List has only ${count} item(s), below minimum of ${LIST_LENGTH.MIN_ITEMS}`,
        suggestion:
          count === 1
            ? 'Consider using prose instead of a single bullet'
            : 'Consider adding more detail or using prose instead',
        research_basis: RESEARCH_CITATIONS.LIST_LENGTH,
      });
      points = Math.max(0, points - 5);
    }

    return {
      rule: 'LIST_LENGTH',
      max_points: LIST_LENGTH.POINTS,
      earned_points: points,
      issues,
    };
  }

  /**
   * Validate hierarchy depth against information architecture research
   */
  private validateHierarchy(items: BulletItem[]): RuleScore {
    const maxDepth = this.calculateMaxDepth(items);
    const issues: ValidationIssue[] = [];
    let points: number = HIERARCHY.POINTS;

    if (maxDepth > HIERARCHY.HARD_MAX_DEPTH) {
      issues.push({
        rule: 'HIERARCHY',
        severity: 'error',
        message: `Hierarchy depth of ${maxDepth} exceeds usable maximum of ${HIERARCHY.HARD_MAX_DEPTH}`,
        suggestion: 'Flatten structure or use a table for complex relationships',
        research_basis: RESEARCH_CITATIONS.HIERARCHY,
      });
      points = 0;
    } else if (maxDepth > HIERARCHY.MAX_DEPTH) {
      issues.push({
        rule: 'HIERARCHY',
        severity: 'warning',
        message: `Hierarchy depth of ${maxDepth} exceeds recommended maximum of ${HIERARCHY.MAX_DEPTH}`,
        suggestion: 'Consider flattening to 2 levels for better comprehension',
        research_basis: RESEARCH_CITATIONS.HIERARCHY,
      });
      points = Math.max(0, points - 8);
    }

    return {
      rule: 'HIERARCHY',
      max_points: HIERARCHY.POINTS,
      earned_points: points,
      issues,
    };
  }

  /**
   * Validate line length against typography research
   */
  private validateLineLength(items: BulletItem[]): RuleScore {
    const issues: ValidationIssue[] = [];
    let totalPenalty = 0;

    const checkItem = (item: BulletItem, index: number) => {
      const length = item.text.length;

      if (length > LINE_LENGTH.HARD_MAX_CHARS) {
        issues.push({
          rule: 'LINE_LENGTH',
          severity: 'warning',
          message: `Item ${index + 1} is too long (${length} chars), exceeds readable maximum of ${LINE_LENGTH.HARD_MAX_CHARS}`,
          item_index: index,
          suggestion: 'Break into two bullets or trim to essential information',
          research_basis: RESEARCH_CITATIONS.LINE_LENGTH,
        });
        totalPenalty += 5;
      } else if (length > LINE_LENGTH.OPTIMAL_MAX_CHARS) {
        issues.push({
          rule: 'LINE_LENGTH',
          severity: 'suggestion',
          message: `Item ${index + 1} is slightly long (${length} chars), above optimal of ${LINE_LENGTH.OPTIMAL_MAX_CHARS}`,
          item_index: index,
          suggestion: 'Consider trimming for easier scanning',
          research_basis: RESEARCH_CITATIONS.LINE_LENGTH,
        });
        totalPenalty += 2;
      } else if (length < LINE_LENGTH.MIN_CHARS && length > 0) {
        issues.push({
          rule: 'LINE_LENGTH',
          severity: 'suggestion',
          message: `Item ${index + 1} is short (${length} chars), may appear sparse`,
          item_index: index,
          suggestion: 'Consider adding detail or combining with a related point',
          research_basis: RESEARCH_CITATIONS.LINE_LENGTH,
        });
        totalPenalty += 1;
      }

      // Check children recursively
      if (item.children) {
        item.children.forEach((child, childIndex) =>
          checkItem(child, index * 100 + childIndex)
        );
      }
    };

    items.forEach((item, index) => checkItem(item, index));

    return {
      rule: 'LINE_LENGTH',
      max_points: LINE_LENGTH.POINTS,
      earned_points: Math.max(0, LINE_LENGTH.POINTS - totalPenalty),
      issues,
    };
  }

  /**
   * Validate serial position - important items should be first/last
   */
  private validateSerialPosition(items: BulletItem[]): RuleScore {
    const issues: ValidationIssue[] = [];
    let points: number = SERIAL_POSITION.POINTS;

    // Check if items have importance hints
    const hasImportance = items.some((item) => item.importance);

    if (hasImportance && items.length > 3) {
      const highImportanceItems = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.importance === 'high');

      highImportanceItems.forEach(({ item, index }) => {
        const isPrimacy = index < SERIAL_POSITION.PRIMACY_ZONE;
        const isRecency = index >= items.length - SERIAL_POSITION.RECENCY_ZONE;

        if (!isPrimacy && !isRecency) {
          const shortText =
            item.text.length > 40 ? item.text.substring(0, 40) + '...' : item.text;
          issues.push({
            rule: 'SERIAL_POSITION',
            severity: 'warning',
            message: `High-importance item "${shortText}" is in recall valley (position ${index + 1})`,
            item_index: index,
            suggestion: `Move to position 1, 2, or ${items.length} for better recall`,
            research_basis: RESEARCH_CITATIONS.SERIAL_POSITION,
          });
          points -= 5;
        }
      });
    } else if (items.length > 4) {
      // Provide guidance even without explicit importance
      issues.push({
        rule: 'SERIAL_POSITION',
        severity: 'suggestion',
        message: `Consider placing most critical information in positions 1, 2, or ${items.length}`,
        suggestion: `Items in positions 3-${items.length - 1} are in the "recall valley" with lower retention`,
        research_basis: RESEARCH_CITATIONS.SERIAL_POSITION,
      });
    }

    return {
      rule: 'SERIAL_POSITION',
      max_points: SERIAL_POSITION.POINTS,
      earned_points: Math.max(0, points),
      issues,
    };
  }

  /**
   * Validate parallel grammatical structure
   */
  private validateStructure(items: BulletItem[]): RuleScore {
    const issues: ValidationIssue[] = [];
    let points: number = STRUCTURE.POINTS;

    if (items.length < 2) {
      return { rule: 'STRUCTURE', max_points: STRUCTURE.POINTS, earned_points: points, issues };
    }

    // Detect starting patterns
    const patterns = items.map((item) => this.detectGrammarPattern(item.text));
    const dominantPattern = this.getMostCommon(patterns);

    patterns.forEach((pattern, index) => {
      if (dominantPattern && pattern !== 'unknown' && pattern !== dominantPattern && dominantPattern !== 'unknown') {
        issues.push({
          rule: 'STRUCTURE',
          severity: 'warning',
          message: `Item ${index + 1} uses "${pattern}" pattern while most items use "${dominantPattern}"`,
          item_index: index,
          suggestion: `Rewrite to match the "${dominantPattern}" pattern for consistency`,
          research_basis: RESEARCH_CITATIONS.STRUCTURE,
        });
        points -= 4;
      }
    });

    return {
      rule: 'STRUCTURE',
      max_points: STRUCTURE.POINTS,
      earned_points: Math.max(0, points),
      issues,
    };
  }

  /**
   * Validate first words are unique and scannable
   */
  private validateFirstWords(items: BulletItem[]): RuleScore {
    const issues: ValidationIssue[] = [];
    let points: number = FIRST_WORDS.POINTS;

    // Extract first N words from each item
    const firstWords = items.map((item) => {
      const words = item.text.trim().split(/\s+/);
      return words.slice(0, FIRST_WORDS.CRITICAL_WORD_COUNT).join(' ').toLowerCase();
    });

    // Check for duplicates
    const seen = new Map<string, number[]>();
    firstWords.forEach((words, index) => {
      if (!seen.has(words)) {
        seen.set(words, []);
      }
      seen.get(words)!.push(index);
    });

    seen.forEach((indices, words) => {
      if (indices.length > 1) {
        issues.push({
          rule: 'FIRST_WORDS',
          severity: 'warning',
          message: `Items ${indices.map((i) => i + 1).join(', ')} start with similar words "${words}"`,
          suggestion:
            'Vary the opening words to help readers quickly distinguish between items',
          research_basis: RESEARCH_CITATIONS.FIRST_WORDS,
        });
        points -= 3;
      }
    });

    return {
      rule: 'FIRST_WORDS',
      max_points: FIRST_WORDS.POINTS,
      earned_points: Math.max(0, points),
      issues,
    };
  }

  /**
   * Validate formatting consistency (punctuation, capitalization)
   */
  private validateFormatting(items: BulletItem[]): RuleScore {
    const issues: ValidationIssue[] = [];
    let points: number = FORMATTING.POINTS;

    if (items.length < 2) {
      return { rule: 'FORMATTING', max_points: FORMATTING.POINTS, earned_points: points, issues };
    }

    // Check ending punctuation consistency
    const endChars = items.map((item) => {
      const text = item.text.trim();
      const lastChar = text[text.length - 1];
      if (['.', '!', '?'].includes(lastChar)) return 'sentence';
      if (lastChar === ':') return 'colon';
      return 'none';
    });

    const dominantEnd = this.getMostCommon(endChars);
    const inconsistentEnds = dominantEnd ? endChars.filter((e) => e !== dominantEnd).length : 0;
    if (dominantEnd && inconsistentEnds > 0 && inconsistentEnds < endChars.length) {
      issues.push({
        rule: 'FORMATTING',
        severity: 'suggestion',
        message: `Inconsistent ending punctuation: ${inconsistentEnds} items differ from the majority`,
        suggestion:
          dominantEnd === 'sentence'
            ? 'Add periods to all items for consistency'
            : 'Remove periods from all items for consistency',
        research_basis: RESEARCH_CITATIONS.FORMATTING,
      });
      points -= 2;
    }

    // Check capitalization consistency
    const capitalizations = items.map((item) => {
      const firstChar = item.text.trim()[0];
      return firstChar === firstChar.toUpperCase() ? 'upper' : 'lower';
    });

    const dominantCap = this.getMostCommon(capitalizations);
    const inconsistentCaps = dominantCap ? capitalizations.filter((c) => c !== dominantCap).length : 0;
    if (dominantCap && inconsistentCaps > 0 && inconsistentCaps < capitalizations.length) {
      issues.push({
        rule: 'FORMATTING',
        severity: 'suggestion',
        message: `Inconsistent capitalization: ${inconsistentCaps} items differ from the majority`,
        suggestion:
          dominantCap === 'upper'
            ? 'Capitalize the first letter of all items'
            : 'Use lowercase for the first letter of all items',
        research_basis: RESEARCH_CITATIONS.FORMATTING,
      });
      points -= 2;
    }

    return {
      rule: 'FORMATTING',
      max_points: FORMATTING.POINTS,
      earned_points: Math.max(0, points),
      issues,
    };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Detect grammatical pattern of a bullet item
   */
  private detectGrammarPattern(text: string): GrammarPattern {
    const words = text.trim().split(/\s+/);
    if (words.length === 0) return 'unknown';

    const firstWord = words[0].toLowerCase().replace(/[^a-z]/g, '');

    // Check for imperative verbs
    if (IMPERATIVE_VERBS.has(firstWord)) {
      return 'verb-imperative';
    }

    // Check for gerunds (-ing)
    // Exclude common non-gerund -ing words
    const nonGerunds = new Set([
      'king', 'ring', 'thing', 'string', 'spring', 'swing', 'bring', 'sing',
      'bling', 'fling', 'sling', 'sting', 'wing', 'cling', 'wring',
      'anything', 'everything', 'nothing', 'something',
    ]);
    if (firstWord.endsWith('ing') && firstWord.length > 4 && !nonGerunds.has(firstWord)) {
      return 'verb-gerund';
    }

    // Check for noun phrases (articles)
    if (['the', 'a', 'an', 'this', 'that', 'each', 'every', 'all', 'some'].includes(firstWord)) {
      return 'noun-phrase';
    }

    // Check if it looks like a complete sentence (has common verb patterns)
    const textLower = text.toLowerCase();
    if (
      textLower.includes(' is ') ||
      textLower.includes(' are ') ||
      textLower.includes(' was ') ||
      textLower.includes(' were ') ||
      textLower.includes(' has ') ||
      textLower.includes(' have ') ||
      textLower.includes(' will ') ||
      textLower.includes(' can ')
    ) {
      return 'sentence';
    }

    return 'unknown';
  }

  /**
   * Get the most common element in an array
   * Returns undefined for empty arrays (caller must handle)
   */
  private getMostCommon<T>(arr: T[]): T | undefined {
    if (arr.length === 0) {
      return undefined;
    }

    const counts = new Map<T, number>();
    arr.forEach((item) => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

    let maxCount = 0;
    let mostCommon = arr[0];
    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateMaxDepth(items: BulletItem[], currentDepth = 1): number {
    let max = currentDepth;
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        max = Math.max(max, this.calculateMaxDepth(item.children, currentDepth + 1));
      }
    }
    return max;
  }

  /**
   * Calculate average line length
   */
  private calculateAvgLineLength(items: BulletItem[]): number {
    const lengths: number[] = [];

    const collectLengths = (item: BulletItem) => {
      lengths.push(item.text.length);
      if (item.children) {
        item.children.forEach(collectLengths);
      }
    };

    items.forEach(collectLengths);

    if (lengths.length === 0) return 0;
    return Math.round(lengths.reduce((sum, len) => sum + len, 0) / lengths.length);
  }

  /**
   * Calculate letter grade from score
   */
  private calculateGrade(score: number): Grade {
    if (score >= GRADES.A) return 'A';
    if (score >= GRADES.B) return 'B';
    if (score >= GRADES.C) return 'C';
    if (score >= GRADES.D) return 'D';
    return 'F';
  }

  /**
   * Generate summary text based on analysis
   */
  private generateSummary(score: number, errorCount: number, warningCount: number): string {
    if (score >= 90 && errorCount === 0) {
      return 'Excellent bullet list following evidence-based best practices.';
    } else if (score >= 80 && errorCount === 0) {
      return 'Good bullet list with minor improvements possible.';
    } else if (score >= 70) {
      return `Adequate bullet list. ${warningCount} issue(s) may impact effectiveness.`;
    } else if (errorCount > 0) {
      return `Bullet list has ${errorCount} critical issue(s) that should be addressed.`;
    } else {
      return `Bullet list needs improvement. Review ${warningCount} warning(s) for better results.`;
    }
  }

  /**
   * Get top 3 most impactful improvements
   */
  private getTopImprovements(issues: ValidationIssue[], score: number): StructuredBulletList {
    // Sort by severity (errors first, then warnings, then suggestions)
    const sorted = issues
      .filter((i) => i.suggestion)
      .sort((a, b) => {
        const severityOrder: Record<Severity, number> = { error: 0, warning: 1, suggestion: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    // Return unique suggestions (dedupe)
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const issue of sorted) {
      if (issue.suggestion && !seen.has(issue.suggestion)) {
        seen.add(issue.suggestion);
        unique.push(issue.suggestion);
      }
      if (unique.length >= 3) break;
    }

    return {
      title: 'Suggested Improvements',
      description: this.getImprovementDescription(score, unique.length),
      intro: unique.length > 0 ? 'Consider the following changes:' : '',
      items: unique,
    };
  }

  /**
   * Generate description for improvements based on score
   */
  private getImprovementDescription(score: number, itemCount: number): string {
    if (itemCount === 0) {
      return 'Your bullet list follows best practices.';
    }
    if (score >= 90) {
      return 'Minor tweaks to make your bullet list even better.';
    }
    if (score >= 70) {
      return 'A few adjustments would improve readability and recall.';
    }
    return 'These changes will significantly improve your bullet list.';
  }

  /**
   * Analyze context fit
   */
  private analyzeContext(
    items: BulletItem[],
    context: Context
  ): { fit: ContextFit; feedback?: string } {
    if (context === 'presentation') {
      return {
        fit: 'poor',
        feedback:
          '3M research shows presentations are 43% more persuasive with visuals instead of bullets. Consider using graphics with narration.',
      };
    }

    if (context === 'reference') {
      // Reference materials benefit from clear hierarchy and findability
      const maxDepth = this.calculateMaxDepth(items);
      if (maxDepth === 1 && items.length > 5) {
        return {
          fit: 'good',
          feedback:
            'For reference materials, consider using hierarchy (sub-bullets) to group related items for faster lookup.',
        };
      }
      return {
        fit: 'excellent',
        feedback: 'Well-structured for reference use. Ensure consistent formatting for quick scanning.',
      };
    }

    // Check for heterogeneous content (different grammar patterns suggest different types of info)
    const patterns = items.map((item) => this.detectGrammarPattern(item.text));
    const uniquePatterns = new Set(patterns.filter((p) => p !== 'unknown')).size;

    if (uniquePatterns > 2) {
      return {
        fit: 'good',
        feedback:
          'Content appears heterogeneous. Bullets work best with related, similar items. Consider grouping by category.',
      };
    }

    return { fit: 'excellent' };
  }
}
