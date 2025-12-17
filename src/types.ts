/**
 * Core type definitions for bullet-mcp
 */

// ============================================================================
// Input Types
// ============================================================================

/**
 * A single bullet point item with optional nesting and importance hint
 */
export interface BulletItem {
  /** The text content of the bullet point */
  text: string;
  /** Nested sub-bullets (max 1 level recommended) */
  children?: BulletItem[];
  /** Priority hint for serial position optimization */
  importance?: 'high' | 'medium' | 'low';
}

/**
 * Input to the bullet tool
 */
export interface BulletInput {
  /** Array of bullet items to validate */
  items: BulletItem[];
  /** Usage context affects recommendations */
  context?: 'document' | 'presentation' | 'reference';
}

// ============================================================================
// Validation Types
// ============================================================================

/** Severity level for validation issues */
export type Severity = 'error' | 'warning' | 'suggestion';

/**
 * A single validation issue found during analysis
 */
export interface ValidationIssue {
  /** Rule identifier (e.g., 'LIST_LENGTH', 'HIERARCHY') */
  rule: string;
  /** Severity level */
  severity: Severity;
  /** Human-readable description of the issue */
  message: string;
  /** Which item has the issue (0-indexed) */
  item_index?: number;
  /** Actionable suggestion to fix the issue */
  suggestion?: string;
  /** Citation to supporting research */
  research_basis?: string;
}

/**
 * Score for a single validation rule
 */
export interface RuleScore {
  /** Rule identifier */
  rule: string;
  /** Maximum possible points for this rule */
  max_points: number;
  /** Points earned */
  earned_points: number;
  /** Issues found for this rule */
  issues: ValidationIssue[];
}

// ============================================================================
// Output Types
// ============================================================================

/** Letter grade */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Context fit assessment */
export type ContextFit = 'excellent' | 'good' | 'poor';

/**
 * Complete analysis result returned by the bullet tool
 */
export interface BulletAnalysis {
  /** Overall score from 0-100 */
  overall_score: number;
  /** Letter grade */
  grade: Grade;
  /** Per-rule score breakdown */
  scores: RuleScore[];
  /** Critical issues that should be addressed */
  errors: ValidationIssue[];
  /** Issues that may impact effectiveness */
  warnings: ValidationIssue[];
  /** Optional improvements */
  suggestions: ValidationIssue[];
  /** Brief summary of the analysis */
  summary: string;
  /** Top 3 most impactful improvements to make */
  top_improvements: string[];
  /** Number of bullet items analyzed */
  item_count: number;
  /** Maximum nesting depth found */
  max_depth: number;
  /** Average line length in characters */
  avg_line_length: number;
  /** How well the content fits the specified context */
  context_fit: ContextFit;
  /** Context-specific feedback */
  context_feedback?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Validation configuration options
 */
export interface ValidationConfig {
  /** Treat warnings as errors */
  strictMode: boolean;
  /** Include research citations in output */
  enableResearchCitations: boolean;
}

/**
 * Display configuration options
 */
export interface DisplayConfig {
  /** Enable colored console output */
  colorOutput: boolean;
}

/**
 * Complete configuration for the bullet server
 */
export interface BulletConfig {
  validation: ValidationConfig;
  display: DisplayConfig;
}
