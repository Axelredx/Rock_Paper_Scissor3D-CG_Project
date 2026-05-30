// =============================================================
// room.js — Geometria e rendering della stanza
//
// La stanza è composta da 6 pannelli piatti (pavimento, soffitto,
// 4 pareti), ciascuno suddiviso in 2 triangoli.
// =============================================================

// Crea i 6 pannelli della stanza e li salva in roomPanels:
//    roomPanels = [pavimento, soffitto, pareteNord, pareteSud, pareteEst, pareteOvest]
// Nota: la stanza ha i pannelli definiti in modo antiorario per avere
//       la normale rivolta verso l'interno necessario per Phong o culling.
function buildRoom() {
  const S = 10.0; // metà lato della stanza (stanza 20x20)
  const H = 7.0;  // altezza del soffitto
  const R = 5;    // fattore di tiling della texture (si ripete R volte)

  roomPanels = [
    mkPanel([-S,0,-S,  S,0,-S,  S,0,S,  -S,0,S],  [ 0, 1, 0], R, 'floor'),
    mkPanel([-S,H,S,   S,H,S,   S,H,-S, -S,H,-S], [ 0,-1, 0], R, 'ceiling'),
    mkPanel([ S,0,-S, -S,0,-S, -S,H,-S,  S,H,-S], [ 0, 0, 1], R, 'wallN'),
    mkPanel([-S,0,S,   S,0,S,   S,H,S,  -S,H,S],  [ 0, 0,-1], R, 'wallS'),
    mkPanel([ S,0,S,   S,0,-S,  S,H,-S,  S,H,S],  [-1, 0, 0], R, 'wallE'),
    mkPanel([-S,0,-S, -S,0,S,  -S,H,S,  -S,H,-S], [ 1, 0, 0], R, 'wallW'),
  ];
}

// Crea i buffer WebGL per un singolo pannello quadrangolare: Il quad viene suddiviso in 2 
//      triangoli tramite index buffer.
// Nota: pos4: 12 float (4 vertici per xyz), norm1: normale condivisa, R: tiling UV
function mkPanel(pos4, norm1, R, name) {
  // La normale è la stessa per tutti e 4 i vertici del pannello piatto
  const n4  = [...norm1, ...norm1, ...norm1, ...norm1];
  // UV tiled: si ripetono R volte per creare il motivo della texture
  const uv4 = [0,0, R,0, R,R, 0,R];

  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  // Nota: gl.STATIC_DRAW = i dati non cambiano mai, quindi la GPU può 
  // ottimizzare la memorizzazione e l'accesso
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos4), gl.STATIC_DRAW);

  const nb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n4), gl.STATIC_DRAW);

  const tb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv4), gl.STATIC_DRAW);

  // Index buffer: due triangoli (0,1,2) e (0,2,3) formano il quad
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);

  return { vb, nb, tb, ib, name };
}

// Disegna un singolo pannello della stanza con illuminazione Phong e ombre
function drawPanel(panel, tex, Kd, Ks, Ns, P, V) {
  gl.useProgram(mainProg);

  const _pos = gl.getAttribLocation(mainProg, 'a_position');
  const _nor = gl.getAttribLocation(mainProg, 'a_normal');
  const _tex = gl.getAttribLocation(mainProg, 'a_texcoord');

  gl.bindBuffer(gl.ARRAY_BUFFER, panel.vb);
  // Nota: descrive come leggere i dati dal buffer corrente. 
  // Parametri: indice dell’attribute, numero di componenti (3 per XYZ), tipo (FLOAT), 
  //            normalizza? (false), stride (0=tightly packed), offset iniziale (0)
  gl.vertexAttribPointer(_pos, 3, gl.FLOAT, false, 0, 0);
  // Nota: abilita la lettura dell’attribute dal buffer. Se non chiamata, 
  // lo shader riceve sempre 0 per quell’attribute.
  gl.enableVertexAttribArray(_pos);

  gl.bindBuffer(gl.ARRAY_BUFFER, panel.nb);
  gl.vertexAttribPointer(_nor, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(_nor);

  gl.bindBuffer(gl.ARRAY_BUFFER, panel.tb);
  gl.vertexAttribPointer(_tex, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(_tex);

  // TEXTURE0 = texture del pannello, TEXTURE1 = shadow map
  // Nota: WebGl supporta fino a 8 texture contemporanee; Lo shader usa sia la texture 
  // dell’oggetto che la shadow map contemporaneamente. Se usassimo la stessa unit per 
  // entrambe, sarebbe sovrascritta ogni volta.
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, (tex instanceof WebGLTexture) ? tex : whiteTexture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  // Dico allo shader di leggere la texture unit 1 (delle shadow)
  gl.uniform1i(gl.getUniformLocation(mainProg, 'u_shadowMap'), 1);
  gl.uniform1f(gl.getUniformLocation(mainProg, 'u_shadowBias'), -0.003);
  gl.uniform1f(gl.getUniformLocation(mainProg, 'u_shadowsEnabled'), params.shadows ? 1.0 : 0.0);
  if (g_texMat) gl.uniformMatrix4fv(gl.getUniformLocation(mainProg, 'u_textureMatrix'), false, g_texMat);

  // La stanza non si muove: model matrix = identità
  const I = m4.identity();
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg, 'u_Pmatrix'), false, P);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg, 'u_Vmatrix'), false, V);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg, 'u_Mmatrix'), false, I);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg, 'u_Nmatrix'), false, m4.transpose(m4.inverse(I)));
  gl.uniform1i (gl.getUniformLocation(mainProg, 'u_texture'),    0);
  gl.uniform1f (gl.getUniformLocation(mainProg, 'u_useTexture'), 1.0);
  gl.uniform3fv(gl.getUniformLocation(mainProg, 'u_Kd'), Kd);
  gl.uniform3fv(gl.getUniformLocation(mainProg, 'u_Ks'), Ks);
  gl.uniform1f (gl.getUniformLocation(mainProg, 'u_Ns'), Ns);

  const li = params.lightIntensity, ai = params.ambientIntensity;
  const cx = TARGET[0] + D*Math.sin(PHI)*Math.sin(THETA);
  const cy = TARGET[1] + D*Math.cos(PHI);
  const cz = TARGET[2] + D*Math.sin(PHI)*Math.cos(THETA);
  gl.uniform3fv(gl.getUniformLocation(mainProg, 'u_lightPos'),    [9, 6, 0]);
  // Nota: colore della luce stile 'lampadina' - giallo/aracncio
  gl.uniform3fv(gl.getUniformLocation(mainProg, 'u_lightColor'),  [li, li*0.95, li*0.88]);
  gl.uniform3fv(gl.getUniformLocation(mainProg, 'u_ambientColor'),[ai, ai, ai]);
  gl.uniform3fv(gl.getUniformLocation(mainProg, 'u_cameraPos'),   [cx, cy, cz]);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, panel.ib);
  // Nota: 6 indici -> 2 triangoli
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

// Disegna tutti i pannelli della stanza con le texture appropriate
function drawRoom(P, V) {
  // Disabilitiamo il culling per vedere le pareti dall'interno della stanza
  gl.disable(gl.CULL_FACE);
  roomPanels.forEach(p => {
    let tex, Kd;
    if      (p.name === 'floor')   { tex = roomTextures.floor;   Kd = [0.9,  0.8,  0.65]; }
    else if (p.name === 'ceiling') { tex = roomTextures.ceiling; Kd = [0.88, 0.88, 0.9];  }
    else                           { tex = roomTextures.wall;    Kd = [0.85, 0.85, 0.88]; }
    drawPanel(p, tex, Kd, [0.03, 0.03, 0.03], 4, P, V);
  });
}