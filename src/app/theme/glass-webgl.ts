import { collectGlassSurfaces, MAX_GLASS_SURFACES } from './surfaces'

const VERTEX = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT = `
precision mediump float;

#define MAX_LENSES ${MAX_GLASS_SURFACES}

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_light;
uniform float u_lightMode;
uniform float u_grid;
uniform float u_caustics;
uniform int u_count;
uniform vec4 u_lenses[MAX_LENSES];
uniform vec2 u_meta[MAX_LENSES];

float roundedRect(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec3 backdrop(vec2 uv, float time) {
  vec2 drift = vec2(sin(time * 0.11), cos(time * 0.09)) * 0.035;
  float steel = exp(-dot(uv - vec2(0.14, 0.18) - drift, uv - vec2(0.14, 0.18) - drift) * 11.0);
  float teal = exp(-dot(uv - vec2(0.86, 0.14) + drift, uv - vec2(0.86, 0.14) + drift) * 13.0);
  float slate = exp(-dot(uv - vec2(0.72, 0.88) - drift, uv - vec2(0.72, 0.88) - drift) * 10.0);
  float sand = exp(-dot(uv - vec2(0.28, 0.9) + drift, uv - vec2(0.28, 0.9) + drift) * 16.0);

  vec3 dark = mix(vec3(0.018, 0.022, 0.032), vec3(0.05, 0.045, 0.06), uv.y);
  vec3 light = mix(vec3(0.98, 0.98, 1.0), vec3(0.91, 0.94, 0.96), uv.y);
  vec3 base = mix(dark, light, u_lightMode);
  float amp = mix(1.0, 0.42, u_lightMode);

  base += steel * vec3(0.10, 0.2, 0.3) * amp;
  base += teal * vec3(0.05, 0.22, 0.24) * amp;
  base += slate * vec3(0.12, 0.13, 0.18) * amp;
  base += sand * vec3(0.2, 0.18, 0.12) * amp;

  vec2 grid = abs(fract(uv * vec2(28.0, 18.0)) - 0.5);
  float lines = smoothstep(0.47, 0.5, max(grid.x, grid.y));
  base += lines * u_grid * mix(0.05, 0.03, u_lightMode);

  float grain = fract(sin(dot(uv + time * 0.001, vec2(12.9898, 78.233))) * 43758.5453);
  base += (grain - 0.5) * 0.008;
  return base;
}

vec3 lens(vec4 rect, float radius, float strength, vec2 frag, float time) {
  vec2 center = rect.xy + rect.zw * 0.5;
  vec2 halfSize = rect.zw * 0.5;
  vec2 p = (frag - center) / max(halfSize, vec2(1.0));
  float r = clamp(radius / max(min(halfSize.x, halfSize.y), 1.0), 0.05, 1.0) * 0.5;
  float d = roundedRect(p, vec2(1.0), r);
  if (d > 0.0) return vec3(0.0);

  vec2 uv = frag / u_resolution;
  float edge = smoothstep(0.0, -0.45, d);
  vec2 normal = normalize(p + vec2(0.0001));
  vec2 shift = normal * edge * 0.022 * strength;

  vec3 refracted = vec3(
    backdrop(uv + shift + vec2(0.003, 0.0), time).r,
    backdrop(uv + shift, time).g,
    backdrop(uv + shift - vec2(0.003, 0.0), time).b
  );

  refracted *= mix(0.96, 1.02, u_lightMode);
  float rim = smoothstep(-0.05, 0.0, d) * (1.0 - smoothstep(0.0, 0.08, -d));
  float caustic = sin((uv.x * 9.0 + uv.y * 5.0 + time * 0.16) * 3.14159) * 0.5 + 0.5;
  refracted += caustic * u_caustics * 0.035;
  refracted += rim * mix(0.035, 0.06, u_lightMode);
  return refracted;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_resolution;
  vec3 color = backdrop(uv, u_time);

  for (int i = 0; i < MAX_LENSES; i++) {
    if (i >= u_count) break;
    vec4 rect = u_lenses[i];
    vec2 meta = u_meta[i];
    if (rect.z < 2.0 || rect.w < 2.0) continue;
    vec3 refracted = lens(rect, meta.x, meta.y, frag, u_time);
    if (refracted != vec3(0.0)) color = refracted;
  }

  float wash = dot(normalize(frag - u_resolution * 0.5), vec2(cos(u_light), sin(u_light)));
  color += max(wash, 0.0) * 0.012;
  gl_FragColor = vec4(color, 1.0);
}
`

export interface StartGlassShaderOptions {
  lightMode: boolean
  quality: 'auto' | 'high' | 'medium' | 'low'
  reducedMotion: boolean
  onDegrade?: () => void
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function dprCap(quality: StartGlassShaderOptions['quality']) {
  if (quality === 'high') return 2
  if (quality === 'low') return 1
  if (quality === 'medium') return 1.5
  return 1.5
}

export function startGlassShader(canvas: HTMLCanvasElement, options: StartGlassShaderOptions) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  if (!vertex || !fragment) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  )
  const position = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const loc = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    light: gl.getUniformLocation(program, 'u_light'),
    lightMode: gl.getUniformLocation(program, 'u_lightMode'),
    grid: gl.getUniformLocation(program, 'u_grid'),
    caustics: gl.getUniformLocation(program, 'u_caustics'),
    count: gl.getUniformLocation(program, 'u_count'),
    lenses: gl.getUniformLocation(program, 'u_lenses[0]'),
    meta: gl.getUniformLocation(program, 'u_meta[0]'),
  }

  let frame = 0
  let running = true
  let degraded = false
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap(options.quality))
  const started = performance.now()
  const lensData = new Float32Array(MAX_GLASS_SURFACES * 4)
  const metaData = new Float32Array(MAX_GLASS_SURFACES * 2)
  let frameSamples = 0
  let frameTotal = 0
  let previous = started

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, dprCap(options.quality))
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr))
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
  }
  resize()

  const draw = (now: number) => {
    if (!running) return
    const height = window.innerHeight
    const surfaces = collectGlassSurfaces(document, {
      width: window.innerWidth,
      height,
    })
    lensData.fill(0)
    metaData.fill(0)
    surfaces.forEach((surface, index) => {
      lensData.set(
        [
          surface.x * dpr,
          (height - surface.y - surface.height) * dpr,
          surface.width * dpr,
          surface.height * dpr,
        ],
        index * 4,
      )
      metaData.set([surface.radius * dpr, surface.strength], index * 2)
    })

    const styles = getComputedStyle(document.documentElement)
    const grid = Number.parseFloat(styles.getPropertyValue('--glass-grid')) || 0.22
    const caustics = Number.parseFloat(styles.getPropertyValue('--glass-caustics')) || 0.15

    gl.uniform2f(loc.resolution, canvas.width, canvas.height)
    gl.uniform1f(loc.time, options.reducedMotion ? 0 : (now - started) / 1000)
    gl.uniform1f(loc.light, (340 * Math.PI) / 180)
    gl.uniform1f(loc.lightMode, options.lightMode ? 1 : 0)
    gl.uniform1f(loc.grid, grid)
    gl.uniform1f(loc.caustics, caustics)
    gl.uniform1i(loc.count, surfaces.length)
    gl.uniform4fv(loc.lenses, lensData)
    gl.uniform2fv(loc.meta, metaData)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    const delta = now - previous
    previous = now
    if (now - started > 2000 && !options.reducedMotion) {
      frameSamples += 1
      frameTotal += delta
      if (frameSamples >= 120) {
        if (frameTotal / frameSamples > 24) {
          degraded = true
          running = false
          options.onDegrade?.()
          return
        }
        frameSamples = 0
        frameTotal = 0
      }
    }

    if (!options.reducedMotion) frame = requestAnimationFrame(draw)
  }

  const redraw = () => {
    if (options.reducedMotion && !degraded) draw(performance.now())
  }
  const onResize = () => {
    resize()
    redraw()
  }
  const onScroll = () => redraw()
  const onVisibility = () => {
    if (document.hidden) {
      running = false
      cancelAnimationFrame(frame)
    } else if (!options.reducedMotion && !degraded) {
      running = true
      previous = performance.now()
      frame = requestAnimationFrame(draw)
    }
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  document.addEventListener('visibilitychange', onVisibility)
  draw(performance.now())

  return () => {
    running = false
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('scroll', onScroll, { capture: true })
    document.removeEventListener('visibilitychange', onVisibility)
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
  }
}
