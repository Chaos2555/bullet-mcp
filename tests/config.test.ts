import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, DEFAULT_CONFIG } from '../src/config.js';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.validation.strictMode).toBe(false);
      expect(DEFAULT_CONFIG.validation.enableResearchCitations).toBe(true);
      expect(DEFAULT_CONFIG.display.colorOutput).toBe(true);
    });
  });

  describe('loadConfig', () => {
    it('should return default config when no env vars set', () => {
      delete process.env.BULLET_STRICT_MODE;
      delete process.env.BULLET_NO_CITATIONS;
      delete process.env.BULLET_NO_COLOR;

      const config = loadConfig();

      expect(config.validation.strictMode).toBe(false);
      expect(config.validation.enableResearchCitations).toBe(true);
      expect(config.display.colorOutput).toBe(true);
    });

    it('should enable strict mode when BULLET_STRICT_MODE=true', () => {
      process.env.BULLET_STRICT_MODE = 'true';

      const config = loadConfig();

      expect(config.validation.strictMode).toBe(true);
    });

    it('should not enable strict mode for other values', () => {
      process.env.BULLET_STRICT_MODE = 'false';
      expect(loadConfig().validation.strictMode).toBe(false);

      process.env.BULLET_STRICT_MODE = '1';
      expect(loadConfig().validation.strictMode).toBe(false);

      process.env.BULLET_STRICT_MODE = 'yes';
      expect(loadConfig().validation.strictMode).toBe(false);
    });

    it('should disable citations when BULLET_NO_CITATIONS=true', () => {
      process.env.BULLET_NO_CITATIONS = 'true';

      const config = loadConfig();

      expect(config.validation.enableResearchCitations).toBe(false);
    });

    it('should disable color when BULLET_NO_COLOR=true', () => {
      process.env.BULLET_NO_COLOR = 'true';

      const config = loadConfig();

      expect(config.display.colorOutput).toBe(false);
    });

    it('should handle multiple env vars together', () => {
      process.env.BULLET_STRICT_MODE = 'true';
      process.env.BULLET_NO_CITATIONS = 'true';
      process.env.BULLET_NO_COLOR = 'true';

      const config = loadConfig();

      expect(config.validation.strictMode).toBe(true);
      expect(config.validation.enableResearchCitations).toBe(false);
      expect(config.display.colorOutput).toBe(false);
    });
  });
});
