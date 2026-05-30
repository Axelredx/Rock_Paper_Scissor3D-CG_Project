// =============================================================
// texture.js — Caricamento e gestione delle texture WebGL
// =============================================================

// Crea una texture 1x1 bianca usata come placeholder
// quando un oggetto non ha texture assegnata (usata per esempio nella verifica in room.js
// se un pannello ha o meno una texture assegnata, e in mesh.js per le mesh senza texture
// attraverso la variabile 'whiteTexture').
function makeWhiteTexture() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  // Note: I parametri sono: target, livello mipmap (0=base), formato interno, larghezza, 
  //                          altezza, bordo (sempre 0), formato dati, tipo dati, dati.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255]));
  return t;
}


// Carica una texture da URL in modo asincrono.
// Mentre l'immagine si carica restituisce subito un placeholder marrone.
// Al termine dell'onload carica l'immagine reale e imposta i parametri corretti.
// Nota: In questo modo si evita che il browser si blocchi per aspettare il download
//       ma non è necessario al fine del corretto funzionamento del programma.
function loadTex(url) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  // Placeholder marrone visibile durante il caricamento
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([180, 160, 140, 255]));

  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    // Nota: check bit-a-bit per vedere se è potenza di 2: se potenza di 2
    //       allora solo 1 bit è 1!
    const isPow2 = v => (v & (v - 1)) === 0;
    if (isPow2(img.width) && isPow2(img.height)) {
      // Texture power-of-2: supporta mipmap e tiling (REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      // Nota: linear interpolation (4 pixel) per metodologia di texturing
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // Texture non-power-of-2 (es. foto): CLAMP_TO_EDGE obbligatorio (per UV fuori da [0, 1], 
      // usa il colore del pixel piu’ vicino al bordo), no mipmap
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  };
  img.onerror = () => console.warn('Texture non trovata:', url);
  img.src = url;
  return t;
}

// Carica le texture per pavimento, pareti e soffitto della stanza
function loadRoomTextures() {
  const base = 'resources/assets/general-textures/';
  roomTextures.floor   = loadTex(base + 'WoodFloor007_1K-JPG_Color.jpg');
  roomTextures.wall    = loadTex(base + 'Plaster001_1K-JPG_Color.jpg');
  roomTextures.ceiling = loadTex(base + 'Plaster001_1K-JPG_Color.jpg');
}