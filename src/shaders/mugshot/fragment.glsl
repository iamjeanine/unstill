#include ../includes/noise.glsl

uniform sampler2D uTexture;
uniform float uRevealProgress;
uniform vec2 uMouse;
uniform float uMouseRadius;
uniform float uMagnification;
uniform float uTime;
uniform float uNoiseScale;
uniform float uEdgeSoftness;
uniform vec2 uResolution;
uniform float uOpacity;

varying vec2 vUv;

void main() {
  // --- Base B&W archival image at normal UVs ---
  vec4 colorSample = texture2D(uTexture, vUv);
  float gray = dot(colorSample.rgb, vec3(0.299, 0.587, 0.114));
  vec3 grayscale = vec3(gray);
  vec3 archivalTone = mix(grayscale, grayscale * vec3(0.95, 0.93, 0.90), 0.35);

  // --- Distance from fragment to mouse (aspect-corrected) ---
  float aspect = uResolution.x / uResolution.y;
  vec2 correctedUv = vUv;
  correctedUv.x *= aspect;
  vec2 correctedMouse = uMouse;
  correctedMouse.x *= aspect;
  float dist = length(correctedUv - correctedMouse);

  // --- FBM noise for organic loupe edge (ink-bleed / watercolor) ---
  float noise = fbm(vUv * uNoiseScale + uTime * 0.04);
  float noisyDist = dist + noise * 0.08;

  // --- Loupe mask (controlled by uRevealProgress) ---
  float loupeRadius = uRevealProgress * uMouseRadius;
  float loupeMask = 1.0 - smoothstep(
    loupeRadius - uEdgeSoftness,
    loupeRadius + uEdgeSoftness,
    noisyDist
  );
  loupeMask = clamp(loupeMask, 0.0, 1.0);

  // --- Magnified UV sampling ---
  // Inside the loupe, warp UVs toward the mouse position to create zoom
  vec2 loupeUv = uMouse + (vUv - uMouse) / uMagnification;
  loupeUv = clamp(loupeUv, vec2(0.001), vec2(0.999));

  // Sample magnified color texture
  vec4 magnifiedSample = texture2D(uTexture, loupeUv);

  // --- Chromatic aberration at loupe edge for polish ---
  float edgeZone = smoothstep(0.0, 1.0, 1.0 - abs(loupeMask - 0.5) * 2.0);
  float aberrationStrength = edgeZone * 0.005 * uRevealProgress;
  vec2 mouseDir = vUv - uMouse;
  vec2 aberrationDir = length(mouseDir) > 0.001 ? normalize(mouseDir) : vec2(0.0);

  vec2 loupeUvR = uMouse + (vUv - uMouse + aberrationDir * aberrationStrength) / uMagnification;
  vec2 loupeUvB = uMouse + (vUv - uMouse - aberrationDir * aberrationStrength) / uMagnification;
  loupeUvR = clamp(loupeUvR, vec2(0.001), vec2(0.999));
  loupeUvB = clamp(loupeUvB, vec2(0.001), vec2(0.999));

  vec3 magnifiedColor = vec3(
    texture2D(uTexture, loupeUvR).r,
    magnifiedSample.g,
    texture2D(uTexture, loupeUvB).b
  );

  // --- Compose: B&W outside, magnified color inside loupe ---
  vec3 finalColor = mix(archivalTone, magnifiedColor, loupeMask);

  // --- Edge darkening at loupe boundary (pigment gathering effect) ---
  float edgeDist = abs(loupeMask - 0.5);
  float edgeIntensity = smoothstep(0.0, 0.08, edgeDist);
  finalColor *= mix(0.85, 1.0, edgeIntensity);

  // --- Subtle brightness boost inside loupe (life emerging) ---
  finalColor = mix(finalColor, finalColor * 1.06, loupeMask * 0.5);

  // --- Vignette ---
  float vignette = 1.0 - smoothstep(0.4, 0.9, length(vUv - 0.5));
  finalColor *= mix(0.92, 1.0, vignette);

  gl_FragColor = vec4(finalColor, colorSample.a * uOpacity);
}
