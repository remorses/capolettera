import '@pixi/react'
import { Application, extend, useApplication, useTick } from '@pixi/react'
import { Container, Graphics, Text, TextStyle, Sprite, RenderTexture, ColorMatrixFilter, Assets, type Application as PixiApplication } from 'pixi.js'
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
import { InkBleedFilter, PaperTextureFilter } from './lib/filters'

extend({ Container, Graphics, Text, Sprite })

async function formatCode(code: string, language: string): Promise<string> {
  try {
    const plugins = [prettierPluginEstree, prettierPluginTypescript, prettierPluginBabel, prettierPluginHtml, prettierPluginCss, prettierPluginMarkdown, prettierPluginYaml]
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

interface CapoletteraSceneProps {
  code: string
  textureIndex: number
  height: number
}

interface SceneState {
  textRenderTexture: RenderTexture
  inkFilter: InkBleedFilter
}

function CapoletteraScene({ code, textureIndex, height }: CapoletteraSceneProps) {
  const { app } = useApplication()
  const [scene, setScene] = useState<SceneState | null>(null)
  const timeRef = useRef(0)

  useEffect(() => {
    if (!app) {
      return
    }
    let cancelled = false
    createTextures(app, height, textureIndex).then(({ paper, illuminated }) => {
      if (cancelled) {
        return
      }
      const inkFilter = new InkBleedFilter(paper, height)
      const textRenderTexture = createTextTexture(app, code, paper, illuminated, height)
      setScene({ textRenderTexture, inkFilter })
    })
    return () => {
      cancelled = true
    }
  }, [app, code, height, textureIndex])

  const tickCallback = useCallback(() => {
    timeRef.current += 0.01
    if (scene?.inkFilter) {
      scene.inkFilter.time = timeRef.current
    }
  }, [scene])

  useTick(tickCallback)

  if (!scene) {
    return null
  }

  return (
    <pixiSprite texture={scene.textRenderTexture} filters={[scene.inkFilter]} />
  )
}

async function createTextures(app: PixiApplication, height: number, textureIndex: number) {
  const paperContainer = new Container()
  const bg = new Graphics()
  bg.rect(0, 0, CONFIG.width, height)
  bg.fill(CONFIG.paperColor)
  paperContainer.addChild(bg)

  const paperFilter = new PaperTextureFilter(height)
  paperContainer.filters = [paperFilter]

  const paperTexture = RenderTexture.create({
    width: CONFIG.width,
    height: height,
  })

  app.renderer.render({
    container: paperContainer,
    target: paperTexture,
  })

  const illuminatedBaseTexture = await Assets.load(textureUrls[textureIndex])
  const tempSprite = new Sprite(illuminatedBaseTexture)
  tempSprite.width = CONFIG.initialSquareSize
  tempSprite.height = CONFIG.initialSquareSize

  const colorFilter = new ColorMatrixFilter()
  colorFilter.brightness(1.7, true)
  tempSprite.filters = [colorFilter]

  const illuminatedTexture = RenderTexture.create({
    width: CONFIG.initialSquareSize,
    height: CONFIG.initialSquareSize,
  })

  app.renderer.render({
    container: tempSprite,
    target: illuminatedTexture,
  })

  return { paper: paperTexture, illuminated: illuminatedTexture }
}

function createTextTexture(app: PixiApplication, code: string, paperTexture: RenderTexture, illuminatedTexture: RenderTexture, height: number) {
  const mainContainer = new Container()

  const paperBg = new Sprite(paperTexture)
  mainContainer.addChild(paperBg)

  const textContainer = new Container()
  textContainer.x = CONFIG.padding
  textContainer.y = CONFIG.padding
  mainContainer.addChild(textContainer)

  const initialImage = new Sprite(illuminatedTexture)
  initialImage.x = -10
  initialImage.y = -10
  initialImage.blendMode = 'multiply'
  textContainer.addChild(initialImage)

  const lineHeightPx = CONFIG.fontSize * CONFIG.lineHeight
  const squareTotalWidth = CONFIG.initialSquareSize + CONFIG.initialSquareMargin
  const linesWrappedAroundSquare = Math.ceil(CONFIG.initialSquareSize / lineHeightPx)

  const textStyle = new TextStyle({
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    fontSize: CONFIG.fontSize,
    fill: CONFIG.inkColor,
    lineHeight: CONFIG.fontSize * CONFIG.lineHeight,
    letterSpacing: 0,
    fontWeight: '400',
  })

  const lines = code.split('\n')
  let yOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const text = new Text({
      text: line || ' ',
      style: textStyle,
    })
    text.y = yOffset

    if (i < linesWrappedAroundSquare) {
      text.x = squareTotalWidth
    }

    textContainer.addChild(text)
    yOffset += lineHeightPx
  }

  const renderTexture = RenderTexture.create({
    width: CONFIG.width,
    height: height,
  })

  app.renderer.render({
    container: mainContainer,
    target: renderTexture,
  })

  return renderTexture
}

interface CapoletteraAppProps {
  code: string
  textureIndex: number
}

function CapoletteraApp({ code, textureIndex }: CapoletteraAppProps) {
  const height = calculateHeight(code)

  return (
    <Application
      width={CONFIG.width}
      height={height}
      backgroundColor={CONFIG.paperColor}
      antialias
      resolution={2}
      autoDensity
    >
      <CapoletteraScene code={code} textureIndex={textureIndex} height={height} />
    </Application>
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
        <CapoletteraApp code={renderCode} textureIndex={textureIndex} />
      </div>
    </div>
  )
}
