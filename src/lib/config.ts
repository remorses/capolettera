export const CONFIG = {
  padding: 60,
  lineHeight: 1.15,
  fontSize: 16,
  paperColor: 0xf5f0e6,
  inkColor: '#1a1410',
  width: 800,
  initialSquareSize: 200,
  initialSquareMargin: 12,
  initialSquareColor: 0x1a1410,
}

export const textureUrls = [
  new URL('../../textures/0.png', import.meta.url).href,
  new URL('../../textures/1.png', import.meta.url).href,
  new URL('../../textures/2.png', import.meta.url).href,
  new URL('../../textures/3.png', import.meta.url).href,
  new URL('../../textures/4.png', import.meta.url).href,
  new URL('../../textures/5.png', import.meta.url).href,
  new URL('../../textures/6.png', import.meta.url).href,
  new URL('../../textures/7.png', import.meta.url).href,
  new URL('../../textures/8.png', import.meta.url).href,
]

export const DEFAULT_CODE = `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate first 10 Fibonacci numbers
const results: number[] = [];
for (let i = 0; i < 10; i++) {
  results.push(fibonacci(i));
}

console.log("Fibonacci sequence:");
console.log(results.join(", "));

// Output: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34

interface Point {
  x: number;
  y: number;
}

class Vector implements Point {
  constructor(
    public x: number,
    public y: number
  ) {}

  magnitude(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  normalize(): Vector {
    const mag = this.magnitude();
    return new Vector(this.x / mag, this.y / mag);
  }
}`

export function calculateHeight(code: string): number {
  const lines = code.split('\n')
  const lineHeightPx = CONFIG.fontSize * CONFIG.lineHeight
  const textHeight = lines.length * lineHeightPx
  return Math.max(CONFIG.initialSquareSize + CONFIG.padding * 2, textHeight + CONFIG.padding * 2)
}
