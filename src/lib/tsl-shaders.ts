import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  floor,
  fract,
  dot,
  max,
  abs,
  mix,
  clamp,
  smoothstep,
  texture,
  uv,
  uniform,
  Loop,
} from 'three/tsl'
import { Vector2, CanvasTexture } from 'three/webgpu'

const mod289Vec3 = Fn(([x]: [ReturnType<typeof vec3>]) => {
  return x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0))
})

const mod289Vec2 = Fn(([x]: [ReturnType<typeof vec2>]) => {
  return x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0))
})

const permute = Fn(([x]: [ReturnType<typeof vec3>]) => {
  return mod289Vec3(x.mul(34.0).add(1.0).mul(x))
})

export const snoise = Fn(([v]: [ReturnType<typeof vec2>]) => {
  const C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439)

  const i = floor(v.add(dot(v, C.yy)))
  const x0 = v.sub(i).add(dot(i, C.xx))

  const i1 = vec2(
    float(x0.x.greaterThan(x0.y)).mul(1.0),
    float(x0.x.greaterThan(x0.y).not()).mul(1.0)
  )

  const x12 = x0.xyxy.add(C.xxzz)
  const x12xy = x12.xy.sub(i1)
  const x12zw = x12.zw

  const iMod = mod289Vec2(i)

  const p = permute(
    permute(
      vec3(iMod.y, iMod.y.add(i1.y), iMod.y.add(1.0))
    ).add(vec3(iMod.x, iMod.x.add(i1.x), iMod.x.add(1.0)))
  )

  const m = max(
    vec3(0.5).sub(vec3(dot(x0, x0), dot(x12xy, x12xy), dot(x12zw, x12zw))),
    0.0
  )
  const m2 = m.mul(m)
  const m4 = m2.mul(m2)

  const x = fract(p.mul(C.www)).mul(2.0).sub(1.0)
  const h = abs(x).sub(0.5)
  const ox = floor(x.add(0.5))
  const a0 = x.sub(ox)

  const mFinal = m4.mul(float(1.79284291400159).sub(float(0.85373472095314).mul(a0.mul(a0).add(h.mul(h)))))

  const gx = a0.x.mul(x0.x).add(h.x.mul(x0.y))
  const gy = a0.y.mul(x12xy.x).add(h.y.mul(x12xy.y))
  const gz = a0.z.mul(x12zw.x).add(h.z.mul(x12zw.y))

  return float(130.0).mul(dot(mFinal, vec3(gx, gy, gz)))
})

export const fbm = Fn(([p]: [ReturnType<typeof vec2>]) => {
  const value = float(0).toVar()
  const amplitude = float(0.5).toVar()
  const frequency = float(1.0).toVar()

  Loop(5, () => {
    value.addAssign(amplitude.mul(snoise(p.mul(frequency))))
    amplitude.mulAssign(0.5)
    frequency.mulAssign(2.0)
  })

  return value
})

export interface InkBleedParams {
  textTexture: CanvasTexture
  paperTexture: CanvasTexture
  width: number
  height: number
  inkBleed?: number
  noiseStrength?: number
  distortion?: number
}

export function createInkBleedMaterial(params: InkBleedParams) {
  const {
    textTexture,
    paperTexture,
    width,
    height,
    inkBleed = 0.5,
    noiseStrength = 0.02,
    distortion = 0.15,
  } = params

  const uTime = uniform(0)
  const uResolution = uniform(new Vector2(width, height))
  const uInkBleed = uniform(inkBleed)
  const uNoiseStrength = uniform(noiseStrength)
  const uDistortion = uniform(distortion)

  const textureNode = texture(textTexture)
  const paperTextureNode = texture(paperTexture)

  const outputNode = Fn(() => {
    const vUv = uv()
    const pixelSize = vec2(1.0).div(uResolution)

    const distortionNoise = fbm(vUv.mul(20.0).add(uTime.mul(0.01))).mul(uDistortion)
    const distortedUV = vUv.add(
      vec2(distortionNoise.mul(0.5), distortionNoise.mul(0.3)).mul(pixelSize)
    )

    const textColor = textureNode.sample(distortedUV)
    const paper = paperTextureNode.sample(vUv)

    const luminanceWeights = vec3(0.299, 0.587, 0.114)
    const textLuminance = dot(textColor.rgb, luminanceWeights)
    const paperLuminance = dot(paper.rgb, luminanceWeights)

    const inkCoverage = float(1.0).sub(smoothstep(0.0, paperLuminance, textLuminance)).toVar()

    const bleedAmount = float(0).toVar()
    Loop({ start: -1, end: 2, type: 'int' }, ({ i: dx }) => {
      Loop({ start: -1, end: 2, type: 'int' }, ({ i: dy }) => {
        const sampleUV = distortedUV.add(
          vec2(float(dx), float(dy)).mul(pixelSize).mul(uInkBleed)
        )
        const sampleColor = textureNode.sample(sampleUV)
        const sampleLum = dot(sampleColor.rgb, luminanceWeights)
        bleedAmount.addAssign(
          float(1.0).sub(smoothstep(0.0, paperLuminance, sampleLum)).mul(0.03)
        )
      })
    })
    bleedAmount.subAssign(inkCoverage.mul(0.03))
    inkCoverage.assign(clamp(inkCoverage.add(bleedAmount), 0.0, 1.0))

    const edgeNoise = snoise(vUv.mul(300.0)).mul(uNoiseStrength)
    const fiberNoise = fbm(vUv.mul(150.0)).mul(0.02)

    const edgeMask = smoothstep(0.0, 0.3, inkCoverage).mul(smoothstep(1.0, 0.7, inkCoverage))
    inkCoverage.addAssign(edgeNoise.add(fiberNoise).mul(edgeMask))
    inkCoverage.assign(clamp(inkCoverage, 0.0, 1.0))

    const inkColor = vec3(0.08, 0.06, 0.05).add(vec3(snoise(vUv.mul(50.0))).mul(0.015)).toVar()

    const result = mix(paper.rgb, inkColor, inkCoverage).toVar()

    const vignetteUV = vUv.mul(2.0).sub(1.0)
    const vignette = float(1.0).sub(dot(vignetteUV, vignetteUV).mul(0.08))
    result.mulAssign(vignette)

    return vec4(result, 1.0)
  })

  return {
    outputNode: outputNode(),
    uniforms: {
      uTime,
      uResolution,
      uInkBleed,
      uNoiseStrength,
      uDistortion,
    },
    updateTexture(newTextTexture: CanvasTexture) {
      textureNode.value = newTextTexture
    },
  }
}
