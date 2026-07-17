export const plasmaCoreVertexShader = `
varying vec3 vLocalPosition;
varying vec3 vWorldPosition;

void main() {
  vLocalPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const plasmaCoreFragmentShader = `
varying vec3 vLocalPosition;
varying vec3 vWorldPosition;

uniform float uTime;
uniform float uCoreIntensity;
uniform float uTurbulence;
uniform float uFogDensity;
uniform float uRaymarchSteps;
uniform vec3 uPointer;
uniform float uDisturbance;
uniform float uBreathing;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amplitude;
    p = p * 2.08 + vec3(8.13, 3.71, 5.43);
    amplitude *= 0.52;
  }
  return value;
}

float fieldDensity(vec3 p) {
  float time = uTime * 0.12;
  float radius = length(p * vec3(0.92, 1.08, 0.96));
  float lobe = fbm(p * 1.65 + vec3(time, -time * 0.73, time * 0.42));
  float detail = fbm(p * 4.1 + vec3(-time * 2.0, time * 1.4, time));
  float breathing = 1.0 + sin(uTime * 0.74 + lobe * 2.7) * 0.055 * uBreathing;
  float edge = smoothstep(1.28 * breathing, 0.12, radius + (lobe - 0.5) * 0.42 * uTurbulence);
  float core = smoothstep(0.72, 0.05, radius + (detail - 0.5) * 0.18);
  float pointerWake = exp(-distance(p, uPointer) * 5.8) * uDisturbance;
  float veins = smoothstep(0.76, 1.0, sin((p.x + p.y * 0.7 + p.z * 0.4 + detail) * 11.0 - uTime * 2.3) * 0.5 + 0.5);
  return max(0.0, edge * (0.16 + lobe * 0.58 + detail * 0.32 + veins * 0.18) + core * 0.55 - pointerWake * 0.34);
}

void main() {
  vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
  vec3 rayPosition = vLocalPosition - viewDirection * 0.92;
  vec3 rayStep = viewDirection * (1.95 / max(uRaymarchSteps, 1.0));
  vec3 accumulated = vec3(0.0);
  float alpha = 0.0;

  for (int i = 0; i < 72; i++) {
    if (float(i) >= uRaymarchSteps) break;
    float density = fieldDensity(rayPosition);
    float glow = density * density;
    vec3 cold = vec3(0.05, 0.38, 1.0);
    vec3 cyan = vec3(0.28, 0.9, 1.0);
    vec3 white = vec3(0.58, 0.9, 1.0);
    vec3 color = mix(cold, cyan, density);
    color = mix(color, white, smoothstep(0.76, 1.2, glow) * 0.12);
    accumulated += color * density * (0.0035 + glow * 0.0084) * uCoreIntensity;
    alpha += density * 0.0033 * uFogDensity;
    rayPosition += rayStep;
  }

  float fade = smoothstep(1.46, 0.52, length(vLocalPosition));
  float finalAlpha = clamp(alpha * fade, 0.0, 0.12);
  gl_FragColor = vec4(min(accumulated, vec3(0.82, 1.05, 1.12)), finalAlpha);
}
`;
