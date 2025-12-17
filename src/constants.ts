/**
 * Evidence-based constants for bullet point validation
 * All thresholds derived from cognitive psychology and UX research
 */

// ============================================================================
// List Length Rules (Working Memory Research)
// Miller (1956): 7±2 items; Cowan (2001): 3-4 chunks for complex info
// Columbia Business School: >3-4 points decrease comprehension
// ============================================================================

export const LIST_LENGTH = {
  /** Minimum recommended items */
  MIN_ITEMS: 3,
  /** Optimal number of items */
  OPTIMAL_ITEMS: 5,
  /** Maximum recommended items */
  MAX_ITEMS: 7,
  /** Hard maximum - must subdivide beyond this */
  HARD_MAX_ITEMS: 9,
  /** Points allocated to this rule */
  POINTS: 20,
} as const;

// ============================================================================
// Hierarchy Rules (Information Architecture Research)
// Kiger (1984), Zaphiris (2000), Larson & Czerwinski (1998): 2 levels fastest
// Nielsen: >2 disclosure levels typically have low usability
// ============================================================================

export const HIERARCHY = {
  /** Maximum recommended depth */
  MAX_DEPTH: 2,
  /** Hard maximum - comprehension drops substantially beyond */
  HARD_MAX_DEPTH: 3,
  /** Points allocated to this rule */
  POINTS: 15,
} as const;

// ============================================================================
// Line Length Rules (Typography Research)
// 45-75 characters optimal, 66 ideal for readability
// <40 chars: excessive eye movements; >80 chars: difficult line tracking
// ============================================================================

export const LINE_LENGTH = {
  /** Minimum comfortable length */
  MIN_CHARS: 40,
  /** Optimal minimum */
  OPTIMAL_MIN_CHARS: 45,
  /** Ideal line length */
  OPTIMAL_CHARS: 66,
  /** Optimal maximum */
  OPTIMAL_MAX_CHARS: 75,
  /** Hard maximum for readability */
  HARD_MAX_CHARS: 80,
  /** Points allocated to this rule */
  POINTS: 15,
} as const;

// ============================================================================
// Serial Position Rules (Ebbinghaus 1885, Murdock 1962)
// U-shaped retention curve: items at beginning and end recalled better
// Primacy: first 3-4 items; Recency: last 1-2 items
// ============================================================================

export const SERIAL_POSITION = {
  /** Number of items in primacy zone (first N items) */
  PRIMACY_ZONE: 2,
  /** Number of items in recency zone (last N items) */
  RECENCY_ZONE: 1,
  /** Points allocated to this rule */
  POINTS: 15,
} as const;

// ============================================================================
// Parallel Structure Rules (Frazier et al. 1984)
// Eye-tracking shows significantly faster reading for structurally similar items
// Grammatical consistency creates measurable processing facilitation
// ============================================================================

export const STRUCTURE = {
  /** Points allocated to this rule */
  POINTS: 20,
} as const;

// ============================================================================
// First Words Rules (Nielsen Eye-Tracking Research)
// First two words are critical for scanning decisions
// Readers fixate on initial words when deciding whether to read further
// ============================================================================

export const FIRST_WORDS = {
  /** Number of critical words at start */
  CRITICAL_WORD_COUNT: 2,
  /** Points allocated to this rule */
  POINTS: 10,
} as const;

// ============================================================================
// Formatting Rules (Usability Research)
// Consistent punctuation and capitalization aid scanning
// Simple bullet symbols (round/square) preferred over creative shapes
// ============================================================================

export const FORMATTING = {
  /** Points allocated to this rule */
  POINTS: 5,
} as const;

// ============================================================================
// Grade Thresholds
// ============================================================================

export const GRADES = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  F: 0,
} as const;

// ============================================================================
// Research Citations
// ============================================================================

export const RESEARCH_CITATIONS = {
  LIST_LENGTH:
    'Miller (1956), Cowan (2001): Working memory capacity 3-4 chunks; Columbia Business School: >3-4 key points decrease comprehension',
  HIERARCHY:
    'Kiger (1984), Zaphiris (2000), Nielsen: 2-level structures show fastest performance; >3 levels drops comprehension substantially',
  LINE_LENGTH:
    'Typography research: 45-75 chars optimal, 66 ideal; <40 causes excessive eye movements, >80 makes line tracking difficult',
  SERIAL_POSITION:
    'Ebbinghaus (1885), Murdock (1962): U-shaped retention curve; items at beginning and end recalled significantly better than middle',
  STRUCTURE:
    'Frazier et al. (1984): Parallel grammatical structure enables significantly faster reading through processing facilitation',
  FIRST_WORDS:
    'Nielsen eye-tracking: First 2 words are critical; readers fixate on initial words when deciding whether to read further',
  FORMATTING:
    'Usability research: Consistent punctuation/capitalization aids scanning; simple bullet symbols preferred',
  CONTEXT:
    'Jansen (2014): Bullets improve recall ~33% for homogeneous content; 3M research: presentations 43% more persuasive with visuals vs bullets',
} as const;

// ============================================================================
// Total Points (for calculating percentages)
// ============================================================================

export const TOTAL_POINTS =
  LIST_LENGTH.POINTS +
  HIERARCHY.POINTS +
  LINE_LENGTH.POINTS +
  SERIAL_POSITION.POINTS +
  STRUCTURE.POINTS +
  FIRST_WORDS.POINTS +
  FORMATTING.POINTS;
