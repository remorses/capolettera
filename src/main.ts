import { Application, Container, Assets, Graphics, Text, TextStyle, Filter, GlProgram, RenderTexture, Sprite, Texture, ColorMatrixFilter } from 'pixi.js';

// Import illuminated initial textures (0-8)
const textureUrls = [
  new URL('../textures/0.png', import.meta.url).href,
  new URL('../textures/1.png', import.meta.url).href,
  new URL('../textures/2.png', import.meta.url).href,
  new URL('../textures/3.png', import.meta.url).href,
  new URL('../textures/4.png', import.meta.url).href,
  new URL('../textures/5.png', import.meta.url).href,
  new URL('../textures/6.png', import.meta.url).href,
  new URL('../textures/7.png', import.meta.url).href,
  new URL('../textures/8.png', import.meta.url).href,
];

// Default sample code
const DEFAULT_CODE = `function fibonacci(n: number): number {
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
}`;

// Configuration
const CONFIG = {
  padding: 60,
  lineHeight: 1.15,
  fontSize: 16,
  paperColor: 0xf5f0e6,
  inkColor: '#1a1410',
  width: 800,
  height: 900,
  // Illuminated initial square
  initialSquareSize: 200,
  initialSquareMargin: 12,
  initialSquareColor: 0x1a1410,
};

// Ink bleed and paper distortion shader
const inkBleedFragment = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uPaperTexture;
uniform float uTime;
uniform vec2 uResolution;
uniform float uInkBleed;
uniform float uNoiseStrength;
uniform float uDistortion;

// Simplex noise functions
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                          dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 pixelSize = 1.0 / uResolution;

  // Very subtle paper fiber distortion (reduced from original)
  float distortionNoise = fbm(uv * 20.0 + uTime * 0.01) * uDistortion;
  vec2 distortedUV = uv + vec2(distortionNoise * 0.5, distortionNoise * 0.3) * pixelSize;

  // Get the original text color
  vec4 textColor = texture(uTexture, distortedUV);

  // Get paper texture
  vec4 paper = texture(uPaperTexture, uv);

  // Calculate how much ink is present (darker = more ink)
  // The text is dark on light background, so we use luminance
  float textLuminance = dot(textColor.rgb, vec3(0.299, 0.587, 0.114));
  float paperLuminance = dot(paper.rgb, vec3(0.299, 0.587, 0.114));

  // Ink coverage: where text is darker than paper
  float inkCoverage = 1.0 - smoothstep(0.0, paperLuminance, textLuminance);

  // Very subtle ink bleed - sample neighboring pixels for slight spread
  float bleedAmount = 0.0;
  for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
    for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
      if (dx == 0.0 && dy == 0.0) continue;
      vec2 sampleUV = distortedUV + vec2(dx, dy) * pixelSize * uInkBleed;
      vec4 sampleColor = texture(uTexture, sampleUV);
      float sampleLum = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
      bleedAmount += (1.0 - smoothstep(0.0, paperLuminance, sampleLum)) * 0.03;
    }
  }
  inkCoverage = min(1.0, inkCoverage + bleedAmount);

  // Add very subtle noise to ink edges (paper fiber absorption)
  float edgeNoise = snoise(uv * 300.0) * uNoiseStrength;
  float fiberNoise = fbm(uv * 150.0) * 0.02;

  // Only apply noise at ink edges
  float edgeMask = smoothstep(0.0, 0.3, inkCoverage) * smoothstep(1.0, 0.7, inkCoverage);
  inkCoverage += (edgeNoise + fiberNoise) * edgeMask;
  inkCoverage = clamp(inkCoverage, 0.0, 1.0);

  // Ink color - dark brownish black with subtle variation
  vec3 inkColor = vec3(0.08, 0.06, 0.05);
  inkColor += vec3(snoise(uv * 50.0)) * 0.015;

  // Blend ink with paper
  vec3 result = mix(paper.rgb, inkColor, inkCoverage);

  // Very subtle vignette
  vec2 vignetteUV = uv * 2.0 - 1.0;
  float vignette = 1.0 - dot(vignetteUV, vignetteUV) * 0.08;
  result *= vignette;

  finalColor = vec4(result, 1.0);
}
`;

const defaultVertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

// Paper texture generation shader
const paperTextureFragment = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform vec2 uResolution;
uniform float uSeed;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                          dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p, float seed) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    value += amplitude * snoise(p * frequency + seed);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

void main() {
  vec2 uv = vTextureCoord;

  // Base paper color (warm off-white)
  vec3 paperBase = vec3(0.96, 0.94, 0.90);

  // Large scale color variation
  float largeNoise = fbm(uv * 2.0, uSeed) * 0.03;

  // Medium fiber texture
  float mediumFiber = fbm(uv * 15.0, uSeed + 100.0) * 0.025;

  // Fine grain texture
  float fineGrain = snoise(uv * 200.0 + uSeed) * 0.015;

  // Paper fiber direction (slight horizontal bias like real paper)
  float fiberDirection = fbm(vec2(uv.x * 30.0, uv.y * 10.0), uSeed + 200.0) * 0.02;

  // Combine all noise layers
  float totalNoise = largeNoise + mediumFiber + fineGrain + fiberDirection;

  // Add subtle warm/cool variation
  vec3 warmTint = vec3(1.0, 0.98, 0.95);
  vec3 coolTint = vec3(0.97, 0.98, 1.0);
  float tintMix = fbm(uv * 5.0, uSeed + 300.0) * 0.5 + 0.5;
  vec3 tint = mix(warmTint, coolTint, tintMix);

  // Apply noise and tint to paper
  vec3 paperColor = paperBase * tint + vec3(totalNoise);

  // Add occasional darker specks (paper impurities)
  float specks = step(0.98, snoise(uv * 500.0 + uSeed));
  paperColor -= specks * 0.1;

  // Subtle edge darkening (aging effect)
  vec2 edgeDist = abs(uv - 0.5) * 2.0;
  float edgeDarken = pow(max(edgeDist.x, edgeDist.y), 4.0) * 0.05;
  paperColor -= edgeDarken;

  finalColor = vec4(paperColor, 1.0);
}
`;

class InkBleedFilter extends Filter {
  constructor(paperTexture: Texture) {
    const glProgram = GlProgram.from({
      vertex: defaultVertex,
      fragment: inkBleedFragment,
    });

    super({
      glProgram,
      resources: {
        inkBleedUniforms: {
          uTime: { value: 0, type: 'f32' },
          uResolution: { value: [CONFIG.width, CONFIG.height], type: 'vec2<f32>' },
          uInkBleed: { value: 0.5, type: 'f32' },
          uNoiseStrength: { value: 0.02, type: 'f32' },
          uDistortion: { value: 0.15, type: 'f32' },
        },
        uPaperTexture: paperTexture.source,
      },
    });
  }

  get time(): number {
    return this.resources.inkBleedUniforms.uniforms.uTime;
  }

  set time(value: number) {
    this.resources.inkBleedUniforms.uniforms.uTime = value;
  }
}

class PaperTextureFilter extends Filter {
  constructor() {
    const glProgram = GlProgram.from({
      vertex: defaultVertex,
      fragment: paperTextureFragment,
    });

    super({
      glProgram,
      resources: {
        paperUniforms: {
          uResolution: { value: [CONFIG.width, CONFIG.height], type: 'vec2<f32>' },
          uSeed: { value: Math.random() * 1000, type: 'f32' },
        },
      },
    });
  }
}

async function createPaperTexture(app: Application): Promise<Texture> {
  const paperContainer = new Container();
  const bg = new Graphics();
  bg.rect(0, 0, CONFIG.width, CONFIG.height);
  bg.fill(CONFIG.paperColor);
  paperContainer.addChild(bg);

  const paperFilter = new PaperTextureFilter();
  paperContainer.filters = [paperFilter];

  const renderTexture = RenderTexture.create({
    width: CONFIG.width,
    height: CONFIG.height,
  });

  app.renderer.render({
    container: paperContainer,
    target: renderTexture,
  });

  return renderTexture;
}

// Global state
let app: Application;
let paperTexture: Texture;
let inkFilter: InkBleedFilter;

async function renderImage(code: string, textureIndex: number) {
  // Clear stage
  app.stage.removeChildren();

  // Create main container
  const mainContainer = new Container();

  // Add paper background sprite
  const paperBg = new Sprite(paperTexture);
  mainContainer.addChild(paperBg);

  // Create text container
  const textContainer = new Container();
  textContainer.x = CONFIG.padding;
  textContainer.y = CONFIG.padding;
  mainContainer.addChild(textContainer);

  // Add illuminated initial image
  const illuminatedTexture = await Assets.load(textureUrls[textureIndex]);

  // First render the image with brightness filter to a texture
  const tempSprite = new Sprite(illuminatedTexture);
  tempSprite.width = CONFIG.initialSquareSize;
  tempSprite.height = CONFIG.initialSquareSize;

  // Apply brightness/contrast filter to push gray to white
  const colorFilter = new ColorMatrixFilter();
  colorFilter.brightness(1.7, true);
  tempSprite.filters = [colorFilter];

  // Render to texture
  const brightenedTexture = RenderTexture.create({
    width: CONFIG.initialSquareSize,
    height: CONFIG.initialSquareSize,
  });
  app.renderer.render({
    container: tempSprite,
    target: brightenedTexture,
  });

  // Now create the final sprite with multiply blend mode
  const initialImage = new Sprite(brightenedTexture);
  initialImage.x = -10;
  initialImage.y = -10;
  initialImage.blendMode = 'multiply';
  textContainer.addChild(initialImage);

  // Calculate how many lines the square spans
  const lineHeightPx = CONFIG.fontSize * CONFIG.lineHeight;
  const squareTotalWidth = CONFIG.initialSquareSize + CONFIG.initialSquareMargin;
  const linesWrappedAroundSquare = Math.ceil(CONFIG.initialSquareSize / lineHeightPx);

  // Define text style
  const textStyle = new TextStyle({
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    fontSize: CONFIG.fontSize,
    fill: CONFIG.inkColor,
    lineHeight: CONFIG.fontSize * CONFIG.lineHeight,
    letterSpacing: 0,
    fontWeight: '400',
  });

  // Create text lines with wrapping around the initial square
  const lines = code.split('\n');
  let yOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = new Text({
      text: line || ' ',
      style: textStyle,
    });
    text.y = yOffset;

    if (i < linesWrappedAroundSquare) {
      text.x = squareTotalWidth;
    }

    textContainer.addChild(text);
    yOffset += lineHeightPx;
  }

  // Create a render texture for the text with paper
  const textRenderTexture = RenderTexture.create({
    width: CONFIG.width,
    height: CONFIG.height,
  });

  // Render the main container to texture
  app.renderer.render({
    container: mainContainer,
    target: textRenderTexture,
  });

  // Create final sprite with ink bleed filter
  const finalSprite = new Sprite(textRenderTexture);
  finalSprite.filters = [inkFilter];

  // Add to stage
  app.stage.addChild(finalSprite);
}

async function init() {
  // Create the PixiJS application
  app = new Application();

  await app.init({
    width: CONFIG.width,
    height: CONFIG.height,
    backgroundColor: CONFIG.paperColor,
    antialias: true,
    resolution: 2,
    autoDensity: true,
  });

  // Add canvas to the DOM
  const canvasContainer = document.getElementById('canvas-container');
  if (canvasContainer) {
    canvasContainer.appendChild(app.canvas);
  }

  // Load font
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
  await document.fonts.ready;

  // Generate paper texture
  paperTexture = await createPaperTexture(app);

  // Create ink filter
  inkFilter = new InkBleedFilter(paperTexture);

  // Animate ink effect
  let time = 0;
  app.ticker.add((ticker) => {
    time += ticker.deltaTime * 0.01;
    inkFilter.time = time;
  });

  // Get UI elements
  const codeInput = document.getElementById('code-input') as HTMLTextAreaElement;
  const textureSelect = document.getElementById('texture-select') as HTMLSelectElement;

  // Set default code
  codeInput.value = DEFAULT_CODE;

  // Initial render
  await renderImage(DEFAULT_CODE, parseInt(textureSelect.value));

  // Debounce helper
  let debounceTimer: number;
  const debounceRender = () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(async () => {
      const code = codeInput.value || DEFAULT_CODE;
      const textureIndex = parseInt(textureSelect.value);
      await renderImage(code, textureIndex);
    }, 300);
  };

  // Auto-generate on texture change
  textureSelect.addEventListener('change', async () => {
    const code = codeInput.value || DEFAULT_CODE;
    const textureIndex = parseInt(textureSelect.value);
    await renderImage(code, textureIndex);
  });

  // Auto-generate on code input change (debounced)
  codeInput.addEventListener('input', debounceRender);

  console.log('Capolettera initialized successfully!');
}

// Start the application
init().catch(console.error);
