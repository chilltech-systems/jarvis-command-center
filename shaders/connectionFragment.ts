export const connectionFragmentShader = `
varying float vStrength;
varying float vDepth;
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;

void main() {
  float pulse = sin(uTime * 1.7 + vStrength * 14.0) * 0.5 + 0.5;
  float alpha = (0.018 + vStrength * 0.11 + pulse * 0.028) * uOpacity * vDepth;
  gl_FragColor = vec4(uColor * (0.45 + vStrength * 1.4), alpha);
}
`;
