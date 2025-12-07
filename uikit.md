# Three.js & uikit Guide for Custom Shader Applications

A practical guide for building 2D-style applications with custom shader effects
using Three.js. Based on lessons learned converting a PixiJS application.

## Quick Decision: uikit vs Vanilla Three.js

| Use Case | Recommendation |
|----------|----------------|
| UI with flexbox layout, buttons, text inputs | uikit |
| Custom full-screen shader effects | Vanilla Three.js |
| Mixed UI + shader effects | Vanilla Three.js + HTML overlay |
| 3D scene with UI panels | uikit |

**Rule of thumb**: If you need custom fragment shaders that process the entire
view (like filters/post-processing), use vanilla Three.js directly. uikit's
`CustomContainer` has viewport/camera complexities that are hard to debug.

## Vanilla Three.js Setup (Recommended for Shader Effects)

### Minimal Working Setup

```typescript
import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  Mesh,
  ShaderMaterial,
  CanvasTexture,
  LinearFilter,
  Vector2,
} from 'three'

function createRenderer(container: HTMLElement, width: number, height: number) {
  const renderer = new WebGLRenderer({ 
    antialias: true, 
    preserveDrawingBuffer: true 
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(1) // Use 1 for predictable shader coordinates
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  
  // Orthographic camera for 2D-style rendering
  // Maps (-1,-1) to (1,1) in clip space
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.z = 1

  // Full-screen quad (2x2 fills the -1 to 1 clip space)
  const geometry = new PlaneGeometry(2, 2)
  
  const material = new ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uTime: { value: 0 },
      uResolution: { value: new Vector2(width, height) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main() {
        gl_FragColor = texture2D(uTexture, vUv);
      }
    `,
  })

  const mesh = new Mesh(geometry, material)
  scene.add(mesh)

  return { renderer, scene, camera, material, mesh }
}
```

### Animation Loop

```typescript
let animationId = 0
let time = 0

function animate() {
  animationId = requestAnimationFrame(animate)
  time += 0.01
  material.uniforms.uTime.value = time
  renderer.render(scene, camera)
}

animate()

// Cleanup
function dispose() {
  cancelAnimationFrame(animationId)
  renderer.dispose()
  geometry.dispose()
  material.dispose()
}
```

### Using Canvas2D as Texture Source

```typescript
function createCanvasTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

// Create canvas with text/graphics
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
const ctx = canvas.getContext('2d')!
ctx.fillStyle = 'white'
ctx.fillRect(0, 0, 800, 600)
ctx.fillStyle = 'black'
ctx.font = '16px monospace'
ctx.fillText('Hello World', 50, 50)

// Use as texture
material.uniforms.uTexture.value = createCanvasTexture(canvas)
```

## Common Pitfalls & Solutions

### 1. Canvas/Viewport Clipping Issues

**Problem**: Only part of the content renders, rest is black/clipped.

**Solution**: Use a simple orthographic camera setup with a 2x2 plane:

```typescript
// Camera maps clip space directly
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  /
// 2x2 plane fills the entire view
const geometry = new PlaneGeometry(2, 2)
```

**Avoid**: Trying to match pixel dimensions in Three.js units - it causes
complex camera frustum calculations that are error-prone.

### 2. React Three Fiber Camera Issues

**Problem**: Camera frustum doesn't update when canvas size changes.

**Solution**: Either use vanilla Three.js, or force camera updates:

```typescript
// Bad: Static camera config
<Canvas camera={{ left: -400, right: 400, ... }}>

// Good: Update camera in useEffect
function CameraSetup({ width, height }) {
  const { camera } = useThree()
  useEffect(() => {
    const cam = camera as OrthographicCamera
    cam.left = -1
    cam.right = 1
    cam.top = height / width
    cam.bottom = -height / width
    cam.updateProjectionMatrix()
  }, [camera, width, height])
  return null
}
```

**Best**: Use vanilla Three.js for full-screen shader effects.

### 3. Texture Not Updating

**Problem**: Canvas changes but Three.js doesn't re-render.

**Solution**: Create new texture or mark as needing update:

```typescript
// Option 1: Create new texture (cleaner)
const newTexture = new CanvasTexture(canvas)
material.uniforms.uTexture.value.dispose()
material.uniforms.uTexture.value = newTexture

// Option 2: Update existing texture
texture.needsUpdate = true
```

### 4. Pixel Ratio / DPR Issues

**Problem**: Blurry rendering or coordinate mismatches.

**Solution**: Use DPR 1 for shaders, handle high-DPI in canvas:

```typescript
// Renderer: use pixel ratio 1 for predictable coords
renderer.setPixelRatio(1)

// Canvas texture: scale for high-DPI
const dpr = 2
canvas.width = width * dpr
canvas.height = height * dpr
ctx.scale(dpr, dpr)
// Draw at logical pixels, canvas is 2x resolution
```

### 5. Image Loading Timing

**Problem**: Texture shows blank because image hasn't loaded.

**Solution**: Load image first, then create texture:

```typescript
const [image, setImage] = useState<HTMLImageElement | null>(null)

useEffect(() => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => setImage(img)
  img.src = imageUrl
}, [imageUrl])

// Only create texture when image is loaded
const texture = useMemo(() => {
  if (!image) return null
  return createCanvasWithImage(image)
}, [image])
```

## GLSL Shader Tips

### Standard Vertex Shader for 2D

```glsl
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Useful Fragment Shader Patterns

```glsl
// Texture sampling
vec4 color = texture2D(uTexture, vUv);

// Luminance calculation
float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

// Smooth edge transitions
float edge = smoothstep(0.0, 0.1, value);

// Vignette effect
vec2 vignetteUV = vUv * 2.0 - 1.0;
float vignette = 1.0 - dot(vignetteUV, vignetteUV) * 0.1;
color.rgb *= vignette;

// Simplex noise (include noise functions)
float noise = snoise(vUv * 100.0);
```

### Noise Functions (Copy-Paste Ready)

```glsl
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
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
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
```

## uikit Reference (For UI-Heavy Applications)

If your application needs flexbox layouts, buttons, text inputs, or 3D UI
panels, uikit is a good choice.

### Installation

```bash
pnpm add three @react-three/fiber @react-three/uikit
```

### Basic Usage

```tsx
import { Canvas } from '@react-three/fiber'
import { Fullscreen, Container, Text } from '@react-three/uikit'

function App() {
  return (
    <Canvas gl={{ localClippingEnabled: true }}>
      <Fullscreen flexDirection="column" padding={20} gap={10}>
        <Container backgroundColor="red" padding={16}>
          <Text fontSize={18}>Hello World</Text>
        </Container>
      </Fullscreen>
    </Canvas>
  )
}
```

### Custom Materials in uikit

```tsx
import { MeshPhongMaterial } from 'three'

class FancyMaterial extends MeshPhongMaterial {
  constructor() {
    super({ specular: 0x111111, shininess: 100 })
  }
}

<Container
  backgroundColor="black"
  borderRadius={16}
  borderBend={0.3}
  panelMaterialClass={FancyMaterial}
>
  <Text>Fancy Panel</Text>
</Container>
```

### When NOT to Use uikit

- Full-screen post-processing effects
- Custom fragment shaders that need precise UV control
- Simple 2D rendering without flexbox needs
- When you need predictable pixel-perfect rendering

## Project Structure Recommendation

```
src/
  app.tsx              # Main React component
  lib/
    config.ts          # Constants (dimensions, colors, etc.)
    shaders.ts         # GLSL shader strings
    three-utils.ts     # Three.js helper functions
  components/
    canvas-renderer.tsx # Three.js canvas component
```

## Dependencies

```json
{
  "dependencies": {
    "three": "^0.181.0",
    "@types/three": "^0.181.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Optional (if using React Three Fiber or uikit):
```json
{
  "dependencies": {
    "@react-three/fiber": "^9.0.0",
    "@react-three/uikit": "^1.0.0",
    "@react-three/drei": "^10.0.0"
  }
}
```
