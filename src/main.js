'use strict';

// =============================================================
// main.js — Entry point: inizializzazione e loop principale
//
// Questo file contiene solo le funzioni di alto livello:
//   init()  — setup WebGL, shadow map, caricamento scena
//   loop()  — render loop chiamato ogni frame
//
// Tutta la logica è suddivisa nei moduli in resources/utils/:
//   globals.js  — variabili globali condivise
//   shaders.js  — sorgenti shaders (VS_DEPTH, FS_DEPTH, VS, FS)
//   texture.js  — caricamento e gestione texture
//   room.js     — geometria e rendering della stanza
//   mesh.js     — caricamento OBJ, buffer WebGL, drawOBJ (mesh generico)
//   scene.js    — posizionamento oggetti e animazioni
//   shadow.js   — matrici della luce e depth pass
//   input.js    — tastiera, mouse, touch
//   gui.js      — pannello dat.GUI
//   hud.js      — titolo 2D sovrapposto
//   game.js     — logica gioco RPS e controlli mobile
// =============================================================

// Punto di ingresso: chiamato all'evento 'load' della pagina
async function init() {
  const canvas = document.getElementById('canvas');
  gl = canvas.getContext('webgl');
  if (!gl) { alert('WebGL non supportato!'); return; }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  // Compila i due programmi shader (depth pass e render pass)
  mainProg  = webglUtils.createProgramFromSources(gl, [VS, FS]);
  depthProg = webglUtils.createProgramFromSources(gl, [VS_DEPTH, FS_DEPTH]);

  // L'estensione WEBGL_depth_texture è necessaria per usare una depth texture
  // come attachment di un framebuffer (non disponibile in WebGL di base)
  const depthExt = gl.getExtension('WEBGL_depth_texture');
  if (!depthExt) { console.warn('WEBGL_depth_texture non supportata!'); }

  // --- Crea il framebuffer per la shadow map ---

  // Depth texture: salva la profondità della scena vista dalla luce
  shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, SHADOW_SIZE, SHADOW_SIZE,
                0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  // Nota Filtraggio e wrapping: usiamo NEAREST per evitare artefatti di campionamento
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Color texture fittizia: WebGL richiede un color attachment anche quando
  // ci interessa solo la depth — la creiamo ma non la utilizziamo
  const unusedTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, unusedTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_SIZE, SHADOW_SIZE,
                0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  shadowFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
  // Nota: WebGL richiede che un framebuffer sia "framebuffer complete" per poter essere 
  // usato, anche se fittizio (COLOR_ATTACHMENT0)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, unusedTex, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,  gl.TEXTURE_2D, shadowTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // -- Inizializza texture, stanza e oggetti della scena --
  whiteTexture = makeWhiteTexture(); 
  buildRoom();
  loadRoomTextures();
  await loadSceneObjects();

  // -- Inizializza input, GUI e HUD --
  initInput(canvas);
  initGUI();
  drawHUD();
  window.addEventListener('resize', drawHUD);

  requestAnimationFrame(loop);
}

// Adatta canvas WebGL e canvas HUD alla dimensione della finestra
function resizeCanvas() {
  const c = document.getElementById('canvas');
  c.width  = window.innerWidth;
  c.height = window.innerHeight;
  if (gl) gl.viewport(0, 0, c.width, c.height);
  const h = document.getElementById('hud');
  if (h) { h.width = window.innerWidth; h.height = window.innerHeight; }
}

// =============================================================
// LOOP PRINCIPALE — chiamato ogni frame da requestAnimationFrame
// =============================================================
function loop(ts) {
  // delta time, max 50ms (circa almeno 20 FPS)
  const dt = Math.min((ts - lastTime) / 1000, 0.05); 
  lastTime = ts;
  updateInput(dt);

  // Loading screen per il primo secondo
  // 'Loading Scene...'
  if (ts < 1000) {
    const hud = document.getElementById('hud');
    if (hud) {
      const ctx = hud.getContext('2d');
      ctx.clearRect(0, 0, hud.width, hud.height);
      ctx.fillStyle = 'rgba(10,10,14,1)';
      ctx.fillRect(0, 0, hud.width, hud.height);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
      ctx.fillText('Loading Scene...', hud.width/2, hud.height/2);
      ctx.textAlign = 'left';
    }
    requestAnimationFrame(loop); return;
  }
  if (ts >= 1000 && ts < 1100) drawHUD(); // ripristina HUD dopo il loading

  // Matrici camera (coordinate sferiche -> posizione cartesiana)
  const aspect = gl.canvas.width / gl.canvas.height;
  // Field of view 50 gradi (visione normle), 
  // near 0.1 e far 100 (clipping di oggetti più vicini di 0.1 o più lontani di 100)
  const P = m4.perspective(degToRad(50), aspect, 0.1, 100);
  // posizione camera xyz
  const cx = TARGET[0] + D*Math.sin(PHI)*Math.sin(THETA);
  const cy = TARGET[1] + D*Math.cos(PHI);
  const cz = TARGET[2] + D*Math.sin(PHI)*Math.cos(THETA);
  const V  = m4.inverse(m4.lookAt([cx,cy,cz], TARGET, [0,1,0]));

  // ---- PASSATA 1: shadow map ----
  // Renderizza dal punto di vista della luce per calcolare le profondità
  const { lightView, lightProj } = getLightMatrices();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
  gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.CULL_FACE);
  // Polygon offset: sposta la depth nella shadow map per evitare shadow acne
  // Esempio: sul manichino
  gl.enable(gl.POLYGON_OFFSET_FILL);
  // Nota: valori arbitrari (da migliorare)
  gl.polygonOffset(1.5, 3.0);
  drawSceneDepth(lightView, lightProj);
  gl.disable(gl.POLYGON_OFFSET_FILL);

  // Costruisce la texture matrix: da world space a coordinate UV [0,1] della shadow map
  // "lightView (world space) -> lightProj (clip space [-1,1]) -> bias (UV [0,1])"
  const bias = m4.multiply(
    m4.translate(m4.identity(), 0.5, 0.5, 0.5),
    m4.scale(m4.identity(), 0.5, 0.5, 0.5)
  );
  g_texMat = m4.multiply(bias, m4.multiply(lightProj, lightView));

  // ---- PASSATA 2: render finale con ombre ----
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  drawRoom(P, V);
  updateAnimations(dt);
  sceneObjects.forEach(obj => drawOBJ(obj, P, V));

  requestAnimationFrame(loop);
}

window.addEventListener('load', init);