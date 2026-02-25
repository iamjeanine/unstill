uniform vec2 uParallaxOffset;
uniform vec4 uUvCrop; // (minU, minV, maxU, maxV) — remap UVs to crop watermarks

varying vec2 vUv;

void main() {
  // Remap UV from [0,1] to [minU,maxU] x [minV,maxV]
  vUv = mix(uUvCrop.xy, uUvCrop.zw, uv);
  vec3 pos = position;

  // Parallax offset — subtle positional shift, no vertex distortion
  pos.x += uParallaxOffset.x;
  pos.y += uParallaxOffset.y;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
