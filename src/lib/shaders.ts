export const inkBleedFragment = `
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
`

export const defaultVertex = `
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
`

export const paperTextureFragment = `
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
`
