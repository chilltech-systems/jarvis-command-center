export const connectionVertexShader = `
attribute float lineStrength;
varying float vStrength;
varying float vDepth;
uniform float uTime;

void main() {
  vStrength = lineStrength;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vDepth = smoothstep(-3.8, 1.2, mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;
