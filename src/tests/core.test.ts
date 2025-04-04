import { HeboEval } from '../core';

describe('HeboEval', () => {
  let heboEval: HeboEval;

  beforeEach(() => {
    heboEval = new HeboEval();
  });

  describe('getVersion', () => {
    it('should return a version string', () => {
      const version = heboEval.getVersion();
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
