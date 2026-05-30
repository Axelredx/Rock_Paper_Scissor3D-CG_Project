// =============================================================
// shaders.js — Sorgenti GLSL degli shader WebGL
//
// Contiene due programmi shader:
//   1) DEPTH PASS  (VS_DEPTH + FS_DEPTH): usato nella prima passata
//      per costruire la shadow map dal punto di vista della luce.
//   2) PHONG PASS  (VS + FS): usato nella seconda passata per il
//      render finale con illuminazione Phong e shadow mapping.
// =============================================================

// --- Shader per la depth pass ---

// Vertex shader: trasforma semplicemente i vertici nello spazio della luce
// Nota: a_position riceve posizione vertice e si moltiplica per
//       M (da object space a world space), V (da world space a light space) 
//       e P ( da eye space a clip space).
// Nota: Sia V che P qui sono le matrici riferite alla luce, non alla camera!
const VS_DEPTH = `
attribute vec4 a_position;
uniform mat4 u_Pmatrix;
uniform mat4 u_Vmatrix;
uniform mat4 u_Mmatrix;
void main() {
  gl_Position = u_Pmatrix * u_Vmatrix * u_Mmatrix * a_position;
}
`;

// Fragment shader: scrive la profondità come colore.
// Nota: gl_FragCoord normalizza in [0,1]
// Nota: questo shader non strettamente necessario per salvare la depth nel FBO, ma
//       obbligatorio in questo caso poichè il FBO ha COLOR ATTACHMENT0 (la texture fittizia)
//       e quindi è necessario scrivere qualcosa in gl_FragColor (poichè GPU se lo aspetta
//       ed altrimenti sorge errore: 'GL INVALID OPERATION: Active draw buffers with missing 
//        fragment shader outputs')
const FS_DEPTH = `
precision mediump float;
void main() {
  gl_FragColor = vec4(gl_FragCoord.z, gl_FragCoord.z, gl_FragCoord.z, 1.0);
}
`;

// --- Shader per il render Phong con shadow mapping ---

// Vertex shader: calcola posizione, normali, UV e coordinate per la shadow map
// Nota: si usa u_Nmatrix, che è N=(M^(-1))^T, per trasformare correttamente le normali 
//       quando M contiene scale non uniformi (se si usasse direttamente M, non si garantirebbe più
//       la perpendicolarità, quindi le normali verrebbero distorte e l'illuminazione sarebbe errata).
// Nota: mat3(u Nmatrix): le normali sono vettori 3D, non punti 3D omogenei. Estraiamo quindi
//       solo la parte 3 × 3 (rotazione + scala) ignorando la traslazione.
// Nota: v projectedTexcoord = u textureMatrix * worldPos; trasforma la posizione mondo
//       nello spazio della shadow map.
const VS = `
attribute vec4 a_position;
attribute vec3 a_normal;
attribute vec2 a_texcoord;

uniform mat4 u_Pmatrix;       // proiezione
uniform mat4 u_Vmatrix;       // vista (camera)
uniform mat4 u_Mmatrix;       // modello (oggetto nel mondo)
uniform mat4 u_Nmatrix;       // matrice normali = trasposta dell'inversa di M
uniform mat4 u_textureMatrix; // trasforma posizioni mondo nello spazio UV della shadow map

varying vec3 v_normal;
varying vec3 v_worldPos;
varying vec2 v_texcoord;
varying vec4 v_projectedTexcoord; // coordinate per il lookup nella shadow map

void main() {
  vec4 worldPos       = u_Mmatrix * a_position;
  gl_Position         = u_Pmatrix * u_Vmatrix * worldPos;
  v_normal            = mat3(u_Nmatrix) * a_normal;
  v_worldPos          = worldPos.xyz;
  v_texcoord          = a_texcoord;
  v_projectedTexcoord = u_textureMatrix * worldPos;
}
`;

// Fragment shader: illuminazione Phong + shadow mapping
const FS = `
precision mediump float;

varying vec3 v_normal;
varying vec3 v_worldPos;
varying vec2 v_texcoord;
varying vec4 v_projectedTexcoord;

uniform vec3  u_lightPos;
uniform vec3  u_lightColor;
uniform vec3  u_ambientColor;
uniform vec3  u_cameraPos;
uniform vec3  u_Kd;           // colore diffuso del materiale
uniform vec3  u_Ks;           // colore speculare del materiale
uniform float u_Ns;           // esponente speculare (shininess)
uniform sampler2D u_texture;
uniform float u_useTexture;   // 1.0 = usa texture, 0.0 = usa solo Kd
uniform sampler2D u_shadowMap;
uniform float u_shadowBias;
uniform float u_shadowsEnabled; // 1.0 = ombre attive, 0.0 = disabilitate

void main() {
  // --- Illuminazione Phong ---
  vec3 N = normalize(v_normal);
  vec3 L = normalize(u_lightPos - v_worldPos);   // direzione verso la luce
  vec3 V = normalize(u_cameraPos - v_worldPos);  // direzione verso la camera
  vec3 R = reflect(-L, N);                        // raggio riflesso

  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(R, V), 0.0), max(u_Ns, 1.0));

  vec4 texColor  = texture2D(u_texture, v_texcoord);
  vec3 baseColor = mix(u_Kd, texColor.rgb, u_useTexture);

  // --- Shadow mapping ---
  // Divisione prospettica: porta le coordinate in [0,1]
  vec3 projCoord     = v_projectedTexcoord.xyz / v_projectedTexcoord.w;
  float currentDepth = projCoord.z + u_shadowBias; // bias riduce lo shadow acne

  // Verifica che il frammento sia dentro il frustum della luce
  bool inShadowMap   = projCoord.x >= 0.0 && projCoord.x <= 1.0 &&
                       projCoord.y >= 0.0 && projCoord.y <= 1.0 &&
                       projCoord.z >= 0.0 && projCoord.z <= 1.0;

  // Legge la depth salvata nella shadow map (leggendo il canale rosso) e confronta
  float projectedDepth = texture2D(u_shadowMap, projCoord.xy).r;

  // Se la depth salvata è minore di quella attuale: frammento in ombra
  float shadow = (u_shadowsEnabled > 0.5 && inShadowMap && projectedDepth <= currentDepth)
                 ? 0.0 : 1.0;

  // Luce ambientale sempre presente; diffusa e speculare solo se illuminato
  vec3 color = u_ambientColor * baseColor
             + u_lightColor * diff * baseColor * shadow
             + u_lightColor * u_Ks * spec * shadow;

  gl_FragColor = vec4(color, 1.0);
}
`;