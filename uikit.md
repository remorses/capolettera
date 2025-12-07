# uikit - Three.js UI Framework

## Overview

uikit is a performant 3D UI framework for three.js by pmndrs. It provides:
- Flexbox-based layout (via Yoga)
- GPU-instanced rendering for panels and text
- MSDF font rendering for crisp text at any scale
- Custom material support for shader effects

## Packages

```
@pmndrs/uikit       # Core vanilla package
@react-three/uikit  # React bindings (requires @react-three/fiber)
```

## Core Components

| Component | Description |
|-----------|-------------|
| `Container` | Basic UI container (like HTML `div`) |
| `Text` | Text rendering with MSDF fonts |
| `Image` | Image display component |
| `Custom` | Custom ShaderMaterial integration |
| `Content` | Embed 3D objects in layout |
| `Fullscreen` | Fullscreen viewport binding |

## Basic Usage (React)

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

## Custom Materials

### Method 1: panelMaterialClass

Extend existing THREE.js materials while keeping uikit panel features:

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

### Method 2: CustomContainer with ShaderMaterial

Full shader control (loses built-in panel features):

```tsx
import { Custom } from '@react-three/uikit'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function ShaderPanel() {
  const matRef = useRef()
  
  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta
    }
  })

  return (
    <Custom width={300} height={200}>
      <shaderMaterial
        ref={matRef}
        transparent
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: [300, 200] },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec3 color = vec3(vUv, sin(uTime) * 0.5 + 0.5);
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </Custom>
  )
}
```

## Text Rendering

uikit uses MSDF (Multi-channel Signed Distance Field) fonts for crisp text.

### Built-in Fonts

Default font is Inter. Available weights: thin, light, normal, medium, semi-bold, bold.

### Custom Fonts

Generate MSDF fonts at https://msdf.zap.works/ then:

```tsx
<Container fontFamilies={{
  myFont: {
    normal: "/fonts/my-font.json",
    bold: "/fonts/my-font-bold.json",
  }
}}>
  <Text fontFamily="myFont" fontWeight="bold">Custom Font</Text>
</Container>
```

## Important Properties

### Layout (Flexbox)
- `flexDirection`: "row" | "column" | "row-reverse" | "column-reverse"
- `justifyContent`: "flex-start" | "center" | "flex-end" | "space-between" | "space-around"
- `alignItems`: "flex-start" | "center" | "flex-end" | "stretch"
- `gap`, `padding`, `margin`: number (pixels)
- `width`, `height`: number | "auto" | percentage string
- `flexGrow`, `flexShrink`: number

### Appearance
- `backgroundColor`: ColorRepresentation
- `borderColor`: ColorRepresentation
- `borderWidth`: number
- `borderRadius`: number
- `borderBend`: number (0-1, bends normals for 3D effect)
- `opacity`: number

### Text
- `fontSize`: number
- `color`: ColorRepresentation
- `fontFamily`: string
- `fontWeight`: "normal" | "bold" | number
- `lineHeight`: number
- `letterSpacing`: number
- `textAlign`: "left" | "center" | "right"

## Vanilla Three.js Usage

```ts
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { reversePainterSortStable, Container, Text } from '@pmndrs/uikit'

const renderer = new WebGLRenderer({ antialias: true })
renderer.localClippingEnabled = true
renderer.setTransparentSort(reversePainterSortStable)

const root = new Container({
  backgroundColor: "white",
  sizeX: 8,
  sizeY: 4,
  flexDirection: "column",
})
scene.add(root)

const text = new Text({ text: "Hello", fontSize: 32 })
root.add(text)

function animate(time) {
  root.update(time - prevTime)
  renderer.render(scene, camera)
}
```

## Key Differences from PixiJS

| Feature | PixiJS | uikit |
|---------|--------|-------|
| Rendering | 2D WebGL | 3D WebGL (three.js) |
| Layout | Manual positioning | Flexbox (Yoga) |
| Text | Bitmap/Canvas text | MSDF fonts |
| Shaders | Filter system | ShaderMaterial |
| Coordinates | Pixels (2D) | Three.js units (3D) |

## Applying Post-Processing Effects

For full-scene effects, use @react-three/postprocessing:

```tsx
import { EffectComposer, Bloom } from '@react-three/postprocessing'

<Canvas>
  <Fullscreen>...</Fullscreen>
  <EffectComposer>
    <Bloom intensity={0.5} />
  </EffectComposer>
</Canvas>
```

For per-element effects, use CustomContainer with custom shaders.
