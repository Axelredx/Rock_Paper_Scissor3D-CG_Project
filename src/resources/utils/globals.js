// =============================================================
// globals.js — Variabili globali condivise tra tutti i moduli
//
// Tutte le variabili dichiarate qui sono accessibili dagli altri
// file JS caricati nella stessa pagina (scope globale window).
// =============================================================

// Contesto WebGL — inizializzato in main.js
let gl;

// Programmi shader compilati (Vertex + Fragment) — inizializzati in main.js
// Nota: si usano due programmi diversi per questione di efficienza
//      (la depth pass non ha bisogno di calcolare normali, UV, ecc.)
//       e questo è utile specialmente nel mobile.
let mainProg;   // shader Phong + shadow mapping (render pass)
let depthProg;  // shader depth-only (shadow pass); calcola solo la posizione dei vertici

// Pannelli della stanza e relative texture
// Nota: vb=vertex buffer, nb=normal buffer, tb=tangent buffer, ib=index buffer
let roomPanels   = [];  // array di oggetti { vb, nb, tb, ib, name } 
let roomTextures = {};  // { floor, wall, ceiling } -> WebGLTexture

// Texture 1×1 bianca usata come placeholder quando non c'è texture (Test)
let whiteTexture;

// Timestamp dell'ultimo frame (millisecondi) — usato per calcolare dt (delta time)
let lastTime = 0;

// --- Shadow map ---
let shadowFBO;           // framebuffer per la depth pass (posizioni dei vertici)
// Nota: durante la prima passata di rendering, invece di disegnare su schermo, 
//      disegniamo in shadowTex.
let shadowTex;           // depth texture (SHADOW_SIZE x SHADOW_SIZE)
const SHADOW_SIZE = 1024; // risoluzione in pixel della shadow map
// Texture matrix calcolata ogni frame loop:
// Nota: trasforma posizioni world space -> coordinate UV [0,1] nella shadow map
let g_texMat = null;

// --- Camera sferica ---
// La camera orbita attorno a TARGET a distanza D,
// con azimuth THETA ed elevazione PHI
let THETA = 0;    // azimuth (angolo orizzontale della camera attorno al target)
// Nota: se PHI=0 camera è sopra, se PHI=pi la camera è sotto
//       inoltre è limitata tra [0.05, pi-0.05] per evitare problemi di 'gimbal lock'
//       ovvero evitare che due assi di rotazione si allineino e si perda un grado 
//       di libertà (rotazione verticale)
let PHI   = 1.2;  // elevazione (angolo verticale della camera rispetto al target)
let D     = 6;    // distanza dal target
// Nota: y=1.8 corrisponde all'altezza iniziale della camera
const TARGET = [0, 1.8, 0]; // punto attorno a cui orbita la camera

// Dizionario dei tasti premuti { 'KeyW': true, ... }
const keys = {};
// Esposto su window (quindi globalmente) 
window.keys = keys;

// Parametri controllabili dalla GUI dat.GUI
const params = {
  lightIntensity:   0.8,  // intensità del punto luce
  ambientIntensity: 0.5,  // intensità della luce ambiente
  shadows:          true, // ombre attive/disattivate
  playGame:         false // modalità gioco RPS attiva/disattivata
};
// Esposto su window (quindi globalmente) 
window.params = params;

// --- Oggetti scena ---
// Array di tutti gli oggetti OBJ caricati
const sceneObjects = [];

// Riferimenti diretti agli oggetti animati (per aggiornarne la modelMatrix ogni frame)
let objRock     = null;
let objScissors = null;
let objPaper    = null;

// --- Animazione ---
let animTime = 0;                // tempo accumulato per le animazioni
const TABLE_TOP_Y     = 2.4;    // altezza della superficie del tavolo (x scala 1.8)
const FLOAT_AMPLITUDE = 0.12;   // ampiezza oscillazione verticale in [-0.12, +0.12] sul tavolo
const FLOAT_SPEED     = 1.2;    // velocità avanzamento oscillazione (degli oggetti che fluttuano)

// --- Utility ---
function degToRad(d) { return d * Math.PI / 180; }