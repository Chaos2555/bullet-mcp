/**
 * Configuration management for bullet-mcp
 */

import type { BulletConfig } from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: BulletConfig = {
  validation: {
    strictMode: false,
    enableResearchCitations: true,
  },
  display: {
    colorOutput: true,
  },
};

/**
 * Load configuration from environment variables
 * Environment variables override default values
 */
export function loadConfig(): BulletConfig {
  const config: BulletConfig = {
    validation: { ...DEFAULT_CONFIG.validation },
    display: { ...DEFAULT_CONFIG.display },
  };

  // BULLET_STRICT_MODE - Treat warnings as errors
  if (process.env.BULLET_STRICT_MODE === 'true') {
    config.validation.strictMode = true;
  }

  // BULLET_NO_CITATIONS - Disable research citations in output
  if (process.env.BULLET_NO_CITATIONS === 'true') {
    config.validation.enableResearchCitations = false;
  }

  // BULLET_NO_COLOR - Disable colored output
  if (process.env.BULLET_NO_COLOR === 'true') {
    config.display.colorOutput = false;
  }

  return config;
}
