import { HeboEval } from '../core/index.js';
import { version } from '../utils/package-info.js';

describe('HeboEval', () => {
  let heboEval: HeboEval;

  beforeEach(() => {
    heboEval = new HeboEval();
  });

  describe('instantiation', () => {
    it('should create a new instance', () => {
      expect(heboEval).toBeInstanceOf(HeboEval);
    });
  });

  describe('getVersion', () => {
    it('should return the correct version from package.json', () => {
      const result = heboEval.getVersion();
      expect(result).toBe(version);
    });

    it('should return a valid semver string', () => {
      const result = heboEval.getVersion();
      // Basic semver regex pattern
      const semverPattern = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
      expect(result).toMatch(semverPattern);
    });
  });
});
