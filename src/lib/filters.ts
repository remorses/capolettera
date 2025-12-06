import { Filter, GlProgram, Texture } from 'pixi.js'
import { inkBleedFragment, defaultVertex, paperTextureFragment } from './shaders'
import { CONFIG } from './config'

export class InkBleedFilter extends Filter {
  constructor(paperTexture: Texture, height: number) {
    const glProgram = GlProgram.from({
      vertex: defaultVertex,
      fragment: inkBleedFragment,
    })

    super({
      glProgram,
      resources: {
        inkBleedUniforms: {
          uTime: { value: 0, type: 'f32' },
          uResolution: { value: [CONFIG.width, height], type: 'vec2<f32>' },
          uInkBleed: { value: 0.5, type: 'f32' },
          uNoiseStrength: { value: 0.02, type: 'f32' },
          uDistortion: { value: 0.15, type: 'f32' },
        },
        uPaperTexture: paperTexture.source,
      },
    })
  }

  get time(): number {
    return this.resources.inkBleedUniforms.uniforms.uTime
  }

  set time(value: number) {
    this.resources.inkBleedUniforms.uniforms.uTime = value
  }
}

export class PaperTextureFilter extends Filter {
  constructor(height: number) {
    const glProgram = GlProgram.from({
      vertex: defaultVertex,
      fragment: paperTextureFragment,
    })

    super({
      glProgram,
      resources: {
        paperUniforms: {
          uResolution: { value: [CONFIG.width, height], type: 'vec2<f32>' },
          uSeed: { value: Math.random() * 1000, type: 'f32' },
        },
      },
    })
  }
}
