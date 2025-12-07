import { useState, useCallback, useRef, useEffect } from 'react'
import * as prettier from 'prettier'
import prettierPluginEstree from 'prettier/plugins/estree'
import prettierPluginTypescript from 'prettier/plugins/typescript'
import prettierPluginBabel from 'prettier/plugins/babel'
import prettierPluginHtml from 'prettier/plugins/html'
import prettierPluginCss from 'prettier/plugins/postcss'
import prettierPluginMarkdown from 'prettier/plugins/markdown'
import prettierPluginYaml from 'prettier/plugins/yaml'
import { CONFIG, DEFAULT_CODE, textureUrls, calculateHeight } from './lib/config'
import { inkBleedVertexShader, inkBleedFragmentShader } from './lib/three-shaders'
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

async function formatCode(code: string, language: string): Promise<string> {
  try {
    const plugins = [
      prettierPluginEstree,
      prettierPluginTypescript,
      prettierPluginBabel,
      prettierPluginHtml,
      prettierPluginCss,
      prettierPluginMarkdown,
      prettierPluginYaml,
    ]
    const parserMap: Record<string, string> = {
      typescript: 'typescript',
      javascript: 'babel',
      json: 'json',
      html: 'html',
      css: 'css',
      markdown: 'markdown',
      yaml: 'yaml',
    }
    const formatted = await prettier.format(code, {
      parser: parserMap[language] || 'typescript',
      plugins,
      printWidth: 60,
      tabWidth: 2,
      semi: true,
      singleQuote: true,
    })
    return formatted.trim()
  } catch (e) {
    console.error('Format error:', e)
    return code
  }
}

function createTextCanvas(
  code: string,
  width: number,
  height: number,
  illuminatedImage: HTMLImageElement | null
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const dpr = 2
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  ctx.fillStyle = `rgb(${Math.round((CONFIG.paperColor >> 16) & 0xff)}, ${Math.round((CONFIG.paperColor >> 8) & 0xff)}, ${Math.round(CONFIG.paperColor & 0xff)})`
  ctx.fillRect(0, 0, width, height)

  if (illuminatedImage) {
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(
      illuminatedImage,
      CONFIG.padding - 10,
      CONFIG.padding - 10,
      CONFIG.initialSquareSize,
      CONFIG.initialSquareSize
    )
    ctx.globalCompositeOperation = 'source-over'
  }

  ctx.font = `400 ${CONFIG.fontSize}px "Courier Prime", "Courier New", Courier, monospace`
  ctx.fillStyle = CONFIG.inkColor
  ctx.textBaseline = 'top'

  const lines = code.split('\n')
  const lineHeightPx = CONFIG.fontSize * CONFIG.lineHeight
  const squareTotalWidth = CONFIG.initialSquareSize + CONFIG.initialSquareMargin
  const linesWrappedAroundSquare = Math.ceil(CONFIG.initialSquareSize / lineHeightPx)

  lines.forEach((line, i) => {
    const x = i < linesWrappedAroundSquare ? CONFIG.padding + squareTotalWidth : CONFIG.padding
    const y = CONFIG.padding + i * lineHeightPx
    ctx.fillText(line, x, y)
  })

  return canvas
}

function createPaperCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const r = (CONFIG.paperColor >> 16) & 0xff
  const g = (CONFIG.paperColor >> 8) & 0xff
  const b = CONFIG.paperColor & 0xff

  const imageData = ctx.createImageData(width, height)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15
    imageData.data[i] = Math.min(255, Math.max(0, r + noise))
    imageData.data[i + 1] = Math.min(255, Math.max(0, g + noise))
    imageData.data[i + 2] = Math.min(255, Math.max(0, b + noise))
    imageData.data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)

  return canvas
}

interface ThreeSceneState {
  renderer: WebGLRenderer
  scene: Scene
  camera: OrthographicCamera
  material: ShaderMaterial
  mesh: Mesh
  animationId: number
}

function CapoletteraCanvas({ code, textureIndex }: { code: string; textureIndex: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<ThreeSceneState | null>(null)
  const [illuminatedImage, setIlluminatedImage] = useState<HTMLImageElement | null>(null)

  const height = calculateHeight(code)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setIlluminatedImage(img)
    }
    img.src = textureUrls[textureIndex]
  }, [textureIndex])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(CONFIG.width, height)
    renderer.setPixelRatio(1)
    containerRef.current.appendChild(renderer.domElement)

    const scene = new Scene()

    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1

    const textCanvas = createTextCanvas(code, CONFIG.width, height, illuminatedImage)
    const textTexture = new CanvasTexture(textCanvas)
    textTexture.minFilter = LinearFilter
    textTexture.magFilter = LinearFilter

    const paperCanvas = createPaperCanvas(CONFIG.width, height)
    const paperTexture = new CanvasTexture(paperCanvas)
    paperTexture.minFilter = LinearFilter
    paperTexture.magFilter = LinearFilter

    const material = new ShaderMaterial({
      uniforms: {
        uTexture: { value: textTexture },
        uPaperTexture: { value: paperTexture },
        uTime: { value: 0 },
        uResolution: { value: new Vector2(CONFIG.width, height) },
        uInkBleed: { value: 0.5 },
        uNoiseStrength: { value: 0.02 },
        uDistortion: { value: 0.15 },
      },
      vertexShader: inkBleedVertexShader,
      fragmentShader: inkBleedFragmentShader,
    })

    const geometry = new PlaneGeometry(2, 2)
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)

    let time = 0
    let animationId = 0

    function animate() {
      animationId = requestAnimationFrame(animate)
      time += 0.01
      material.uniforms.uTime.value = time
      renderer.render(scene, camera)
    }

    animate()

    stateRef.current = { renderer, scene, camera, material, mesh, animationId }

    return () => {
      cancelAnimationFrame(animationId)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      textTexture.dispose()
      paperTexture.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [code, height, illuminatedImage])

  useEffect(() => {
    const state = stateRef.current
    if (!state) {
      return
    }

    state.renderer.setSize(CONFIG.width, height)
    state.material.uniforms.uResolution.value.set(CONFIG.width, height)

    const textCanvas = createTextCanvas(code, CONFIG.width, height, illuminatedImage)
    const textTexture = new CanvasTexture(textCanvas)
    textTexture.minFilter = LinearFilter
    textTexture.magFilter = LinearFilter

    state.material.uniforms.uTexture.value.dispose()
    state.material.uniforms.uTexture.value = textTexture
  }, [code, height, illuminatedImage])

  return (
    <div
      ref={containerRef}
      style={{
        width: CONFIG.width,
        height: height,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    />
  )
}

export function App() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [textureIndex, setTextureIndex] = useState(1)
  const [language, setLanguage] = useState('typescript')
  const debounceRef = useRef<number>(undefined)
  const [renderCode, setRenderCode] = useState(DEFAULT_CODE)

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value
    setCode(newCode)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(() => {
      setRenderCode(newCode || DEFAULT_CODE)
    }, 300)
  }, [])

  const handleFormat = useCallback(async () => {
    const formatted = await formatCode(code || DEFAULT_CODE, language)
    setCode(formatted)
    setRenderCode(formatted)
  }, [code, language])

  const handleTextureChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setTextureIndex(parseInt(e.target.value))
  }, [])

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value)
  }, [])

  return (
    <div id="app">
      <div id="controls">
        <h1>Capolettera</h1>
        <div>
          <label htmlFor="texture-select">Illuminated Initial</label>
          <select id="texture-select" value={textureIndex} onChange={handleTextureChange}>
            <option value="0">O - Boatman</option>
            <option value="1">L - Falconer</option>
            <option value="2">D - Knight</option>
            <option value="3">A - Scribe</option>
            <option value="4">C - Lute Player</option>
            <option value="5">A - King</option>
            <option value="6">O - Dragon</option>
            <option value="7">A - Griffin</option>
            <option value="8">W - Chimera</option>
          </select>
        </div>
        <div>
          <label htmlFor="language-select">Language (for formatting)</label>
          <select id="language-select" value={language} onChange={handleLanguageChange}>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="json">JSON</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="markdown">Markdown</option>
            <option value="yaml">YAML</option>
          </select>
        </div>
        <button onClick={handleFormat}>Format Code</button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="code-input">Code</label>
          <textarea
            id="code-input"
            placeholder="Enter your code here..."
            value={code}
            onChange={handleCodeChange}
          />
        </div>
      </div>
      <div id="canvas-container">
        <CapoletteraCanvas code={renderCode} textureIndex={textureIndex} />
      </div>
    </div>
  )
}
