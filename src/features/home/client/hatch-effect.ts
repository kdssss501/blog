import type { Effect, EffectContext, EffectRenderTarget } from "@vfx-js/core";

export interface HatchParams {
	color: string;
	angle: number;
	spacing: number;
	lineWidth: number;
	angleJitter: number;
	offsetJitter: number;
	spacingJitter: number;
	seed: number;
	speed: number;
	roundCap: boolean;
	soft: number;
	originalColor: boolean;
	bypass: boolean;
}

export const DEFAULT_PARAMS: HatchParams = {
	color: "#3366DD",
	angle: 45,
	spacing: 2.5,
	lineWidth: 2,
	angleJitter: 0.5,
	offsetJitter: 2,
	spacingJitter: 0.5,
	seed: 0,
	speed: 8,
	roundCap: true,
	soft: 0,
	originalColor: true,
	bypass: false,
};

const hexToRgb = (hex: string): [number, number, number] => {
	const h = hex.replace("#", "");
	return [0, 2, 4].map(
		(i) => Number.parseInt(h.substring(i, i + 2), 16) / 255,
	) as [number, number, number];
};

const FRAG = `#version 300 es
precision highp float;
in vec2 uvSrc;
out vec4 outColor;
uniform sampler2D src;
uniform vec2  resolution;
uniform float pixelRatio;
uniform vec3  color;
uniform float angle;
uniform float spacing;
uniform float lineWidth;
uniform float angleJitter;
uniform float offsetJitter;
uniform float spacingJitter;
uniform float seed;
uniform float speed;
uniform float time;
uniform float roundCap;
uniform float soft;
uniform float originalColor;
uniform float bypass;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453123); }

float covAt(vec2 p) {
  return texture(src, (p + resolution * 0.5) / resolution).a;
}

vec3 colAt(vec2 p) {
  vec4 t = texture(src, (p + resolution * 0.5) / resolution);
  return t.a > 0.004 ? t.rgb / t.a : t.rgb;
}

void main() {
  if (bypass > 0.5) {
    outColor = texture(src, uvSrc); return;
  }

  vec2  px = uvSrc * resolution - resolution * 0.5;
  float sp = max(spacing * pixelRatio, 1.0);
  float lw = lineWidth * pixelRatio;
  float hw = lw * 0.5;
  float aa = mix(0.6, 2.5, soft);
  float oj = offsetJitter * pixelRatio;
  float sj = spacingJitter * pixelRatio;

  float angleRad  = radians(angle);
  float jitterRad = radians(angleJitter);

  vec2  nor     = vec2(-sin(angleRad), cos(angleRad));
  vec2  baseDir = vec2( cos(angleRad), sin(angleRad));
  float baseIndex = floor(dot(px, nor) / sp);

  float realSeed = seed + hash(floor(time * speed)) * 100.0;

  float extent = dot(abs(baseDir), resolution);
  float jitterFrac = clamp(jitterRad / radians(10.0), 0.0, 1.0);
  int   K = clamp(int(ceil(extent * tan(jitterRad) / sp)) + 2, 3, 24);

  float ink = 0.0;
  vec3  strokeCol = color;
  for (int k = -K; k <= K; k++) {
    float idx = baseIndex + float(k);
    float a   = angleRad + (hash(idx * 1.37 + realSeed) - 0.5) * jitterRad;
    float sa = sin(a), ca = cos(a);
    vec2  n2  = vec2(-sa, ca);
    vec2  dir = vec2( ca, sa);

    float center = (idx + 0.5) * sp + (hash(idx * 3.91 + realSeed) - 0.5) * 2.0 * sj;
    float u  = hash(idx * 7.13 + realSeed) * 2.0 - 1.0;
    vec2  Pp = nor * center + baseDir * (u * jitterFrac * 0.5 * extent);
    float dperp = dot(px - Pp, n2);

    if (abs(dperp) > hw + aa) { continue; }

    float s    = (hash(idx * 5.23 + realSeed) - 0.5) * 2.0 * oj;
    vec2  foot = px - dperp * n2;
    vec2  base = foot - s * dir;

    float ink_k;
    vec2  cpoint = base;
    if (roundCap > 0.5) {
      float g = -1.0, gOff = 0.0;
      float c0 = covAt(base);
      if (c0 > 0.5) {
        g = 0.0;
      } else {
        float pp = c0, pn = c0;
        for (int t = 1; t <= 24; t++) {
          float off = float(t);
          if (off > hw + aa) break;
          float cp = covAt(base + off * dir);
          float cn = covAt(base - off * dir);
          if (cp > 0.5) { float gg = off - (cp - 0.5) / max(cp - pp, 1e-3); g = gg; gOff =  gg; break; }
          if (cn > 0.5) { float gg = off - (cn - 0.5) / max(cn - pn, 1e-3); g = gg; gOff = -gg; break; }
          pp = cp; pn = cn;
        }
      }
      if (g < 0.0) continue;
      float dist = sqrt(dperp * dperp + g * g);
      ink_k  = 1.0 - smoothstep(hw - aa, hw + aa, dist);
      cpoint = base + gOff * dir;
    } else {
      ink_k = (1.0 - smoothstep(hw - aa, hw + aa, abs(dperp))) * covAt(base);
    }

    if (ink_k > ink) {
      ink = ink_k;
      strokeCol = (originalColor > 0.5) ? colAt(cpoint) : color;
    }
  }

  outColor = vec4(strokeCol * ink, ink);
}
`;

const BLIT = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D frozen;
void main() { outColor = texture(frozen, uv); }
`;

export class HatchEffect implements Effect {
	params: HatchParams;
	private _lastStep = -1;
	private rt: EffectRenderTarget | null = null;

	constructor(params: Partial<HatchParams> = {}) {
		this.params = { ...DEFAULT_PARAMS, ...params };
	}

	setParams(params: Partial<HatchParams>) {
		Object.assign(this.params, params);
	}

	render(ctx: EffectContext) {
		const p = this.params;
		const [w, h] = ctx.dims.elementPixel;
		const uniforms = {
			src: ctx.src,
			resolution: [w, h],
			pixelRatio: ctx.dims.pixelRatio,
			color: hexToRgb(p.color),
			angle: p.angle,
			spacing: p.spacing,
			lineWidth: p.lineWidth,
			angleJitter: p.angleJitter,
			offsetJitter: p.offsetJitter,
			spacingJitter: p.spacingJitter,
			seed: p.seed,
			speed: p.speed,
			roundCap: p.roundCap ? 1 : 0,
			soft: p.soft,
			originalColor: p.originalColor ? 1 : 0,
			bypass: p.bypass ? 1 : 0,
			time: ctx.time,
		};

		if (p.speed <= 0) {
			ctx.draw({ frag: FRAG, uniforms, target: ctx.target });
			return;
		}

		if (!this.rt) {
			this.rt = ctx.createRenderTarget({ persistent: true });
			this._lastStep = -1;
		}
		const step = Math.floor(ctx.time * p.speed);
		if (step !== this._lastStep) {
			this._lastStep = step;
			ctx.draw({ frag: FRAG, uniforms, target: this.rt });
		}

		ctx.draw({ frag: BLIT, uniforms: { frozen: this.rt }, target: ctx.target });
	}

	dispose() {
		if (this.rt) {
			this.rt.dispose();
			this.rt = null;
		}
		this._lastStep = -1;
	}
}
