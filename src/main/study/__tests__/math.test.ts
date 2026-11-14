import { describe, expect, it } from 'vitest'
import { validateMathScript } from '../math'

describe('restricted Octave expressions', () => {
  it('allows numeric matrix work and bounded plotting', () => {
    expect(validateMathScript({ script: 'A = [1, 2; 3, 4]; disp(det(A));' }).plot).toBe(false)
    expect(validateMathScript({ script: 'x = linspace(0, 6.28, 100); plot(x, sin(x));', plot: true }).plot).toBe(true)
    expect(validateMathScript({ script: 'A = ones(2, 3); disp(A * A\');' }).script).toContain('A * A')
  })
  it.each([
    'system("whoami")', "eval('1+1')", "fopen('config.json')", 'x = 1:1000000000',
    'A = ones(5000, 5000)', 'x = linspace(0, 1, 2000000)', 'A(999999999) = 1',
    'A = ones(2); A = [A A]', 'for i=1; disp(i); end', 'x = getenv(1)', 'A = ones(exp(100), 2)'
  ])('rejects system/file/code and unbounded array expansion: %s', script => {
    expect(() => validateMathScript({ script })).toThrow()
  })
})
