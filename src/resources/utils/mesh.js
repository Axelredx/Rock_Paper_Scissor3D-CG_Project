// =============================================================
// mesh.js — Caricamento OBJ, costruzione buffer WebGL, model matrix
//
// Gestisce il ciclo completo: fetch del file OBJ → parsing tramite
// glm_utils → upload su GPU come VBO → memorizzazione in sceneObjects.
// =============================================================

// Carica un modello OBJ in modo asincrono e lo aggiunge a sceneObjects.
// Parametri:
//   objUrl      — percorso del file .obj
//   texUrl      — percorso della texture globale (null se non presente)
//   modelMatrix — matrice di trasformazione iniziale
//   mat         — materiale di default { Kd, Ks, Ns }
//   matTextures — (opzionale) { nomeMateriale: urlTexture } per texture per-materiale
async function loadOBJ(objUrl, texUrl, modelMatrix, mat, matTextures) {
  try {
    const resp = await fetch(objUrl);
    if (!resp.ok) { console.warn('OBJ non trovato:', objUrl); return; }

    // Parsing tramite le librerie glm_utils e mesh_utils 
    const mesh   = new subd_mesh();
    const result = glmReadOBJ(await resp.text(), mesh);
    Unitize(mesh); // normalizza le dimensioni del modello al range [-1,1]

    // Se l'OBJ referenzia un MTL, lo scarichiamo e parsiamo per ottenere i materiali
    if (result.fileMtl) {
      const mtlUrl = objUrl.substring(0, objUrl.lastIndexOf('/') + 1) + result.fileMtl;
      try {
        const r = await fetch(mtlUrl);
        if (r.ok) glmReadMTL(await r.text(), mesh);
      } catch(e) {}
    }

    const buffers   = buildOBJBuffers(mesh);
    const globalTex = texUrl ? loadTex(texUrl) : null;

    // matTextures permette di applicare texture diverse a materiali diversi dello stesso OBJ.
    // Esempio: foto applicata solo alla testa del manichino (Material.001)
    const perMatTex = {};
    if (matTextures) {
      for (const [name, url] of Object.entries(matTextures))
        perMatTex[name] = loadTex(url);
    }

    // Salva l'oggetto nella scena con tutti i dati necessari per il rendering in scene.js
    sceneObjects.push({ buffers, texture: globalTex, perMatTex, modelMatrix, mat, mesh });
  } catch(e) {
    console.warn('Errore caricamento OBJ:', objUrl, e);
  }
}

// Raggruppa le facce per materiale e crea un VBO per ciascun gruppo.
// Sottrae minY da tutti i vertici Y per appoggiare il modello al pavimento (y=0)
// così che a model matrix deve solo traslarlo all’altezza desiderata senza dover 
// conoscere le dimensioni originali del modello.
function buildOBJBuffers(mesh) {
  const groups = {};

  // Trova il punto più basso del modello per portarlo a y=0
  let minY = Infinity;
  for (let i = 1; i <= mesh.nvert; i++)
    if (mesh.vert[i].y < minY) minY = mesh.vert[i].y;

  // Itera sulle facce e le raggruppa per indice materiale
  // Esempio: manichino ha materiali diversi, li raggruppiamo t.c. 
  // si può disegnare ogni gruppo con le uniform (Kd, Ks, texture) del suo materiale
  for (let i = 1; i <= mesh.nface; i++) {
    const face   = mesh.face[i];
    const matIdx = face.material !== undefined ? face.material : 0;
    if (!groups[matIdx]) groups[matIdx] = { positions:[], normals:[], texcoords:[] };
    const g = groups[matIdx];

    for (let j = 0; j < face.n_v_e; j++) {
      const vi = face.vert[j];
      // Nota: La libreria glm_utils parte l'indicizzazione da 1!
      g.positions.push(mesh.vert[vi].x, mesh.vert[vi].y - minY, mesh.vert[vi].z);

      const ni = face.normalVertexIndex[j];
      g.normals.push(
        (ni && mesh.normal[ni]) ? mesh.normal[ni].i : 0,
        (ni && mesh.normal[ni]) ? mesh.normal[ni].j : 1,
        (ni && mesh.normal[ni]) ? mesh.normal[ni].k : 0
      );

      const ti = face.textCoordsIndex[j];
      // Flip V (1.0 - mesh.textCoords[ti].v): i file OBJ hanno V=0 in basso, 
      // WebGL lo vuole in alto (senza flip risulta tutto capovolto)!
      g.texcoords.push(
        (ti && mesh.textCoords[ti]) ? mesh.textCoords[ti].u       : 0,
        (ti && mesh.textCoords[ti]) ? 1.0 - mesh.textCoords[ti].v : 0
      );
    }
  }

  // Crea i VBO WebGL per ogni gruppo e legge il Kd dal MTL se disponibile
  const result = [];
  for (const matIdx in groups) {
    const g = groups[matIdx];

    // vertex buffer (posizioni XYZ vertici)
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.positions), gl.STATIC_DRAW);

    // normal buffer (normali XYZ per illuminazione Phong)
    const nb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.normals), gl.STATIC_DRAW);

    // texcoord buffer (coordinate UV per texturing)
    const tb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.texcoords), gl.STATIC_DRAW);

    // Legge il colore Kd dal materiale se disponibile, altrimenti null
    const kd = (mesh.materials && mesh.materials[matIdx])
      ? mesh.materials[matIdx].parameter.get('Kd') : null;

    result.push({ vb, nb, tb, count: g.positions.length / 3, matIdx: parseInt(matIdx), Kd: kd || null });
  }
  return result;
}

// Costruisce una model matrix TRS: Translate x RotateY x Scale
// Nota: in WebGL vengono applicate da destra a sinistra (opposto a come dichiarate)!
function buildModelMatrix(pos, rotY, scale) {
  let M = m4.translate(m4.identity(), pos[0], pos[1], pos[2]);
  M = m4.yRotate(M, rotY);
  M = m4.scale(M, scale[0], scale[1], scale[2]);
  return M;
}

// Disegna un oggetto OBJ con illuminazione Phong e shadow mapping.
// Gestisce diversi casi per la texture: per-materiale, globale, colore flat.
// Nota: funzione simil-analoga a drawPanlel in room.js
function drawOBJ(obj, P, V) {
  gl.useProgram(mainProg);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  const _pos = gl.getAttribLocation(mainProg, 'a_position');
  const _nor = gl.getAttribLocation(mainProg, 'a_normal');
  const _tex = gl.getAttribLocation(mainProg, 'a_texcoord');

  // Model matrix dell'oggetto (posizione, rotazione, scala)
  const M  = obj.modelMatrix;
  // Matrice delle normali: trasposta dell'inversa della model matrix.
  // Necessaria per trasformare correttamente le normali (corretta illuminazione, etc.)
  // quando la mesh è scalata.
  const N  = m4.transpose(m4.inverse(M));
  const li = params.lightIntensity, ai = params.ambientIntensity;
  const cx = TARGET[0] + D*Math.sin(PHI)*Math.sin(THETA);
  const cy = TARGET[1] + D*Math.cos(PHI);
  const cz = TARGET[2] + D*Math.sin(PHI)*Math.cos(THETA);

  // Uniform condivise da tutti i gruppi materiale dell'oggetto
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg,'u_Pmatrix'), false, P);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg,'u_Vmatrix'), false, V);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg,'u_Mmatrix'), false, M);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainProg,'u_Nmatrix'), false, N);

  // Shadow map su TEXTURE1 (separata dalla texture oggetto su TEXTURE0)
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.uniform1i(gl.getUniformLocation(mainProg,'u_shadowMap'), 1);
  gl.uniform1f(gl.getUniformLocation(mainProg,'u_shadowBias'), -0.003);
  gl.uniform1f(gl.getUniformLocation(mainProg,'u_shadowsEnabled'), params.shadows ? 1.0 : 0.0);
  if (g_texMat) gl.uniformMatrix4fv(gl.getUniformLocation(mainProg,'u_textureMatrix'), false, g_texMat);

  gl.uniform3fv(gl.getUniformLocation(mainProg,'u_lightPos'),    [9,6,0]);
  gl.uniform3fv(gl.getUniformLocation(mainProg,'u_lightColor'),  [li,li*0.95,li*0.88]);
  gl.uniform3fv(gl.getUniformLocation(mainProg,'u_ambientColor'),[ai,ai,ai]);
  gl.uniform3fv(gl.getUniformLocation(mainProg,'u_cameraPos'),   [cx,cy,cz]);

  // Disegna ogni gruppo materiale separatamente
  obj.buffers.forEach(group => {
    gl.bindBuffer(gl.ARRAY_BUFFER, group.vb);
    gl.vertexAttribPointer(_pos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(_pos);

    gl.bindBuffer(gl.ARRAY_BUFFER, group.nb);
    gl.vertexAttribPointer(_nor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(_nor);

    gl.bindBuffer(gl.ARRAY_BUFFER, group.tb);
    gl.vertexAttribPointer(_tex, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(_tex);

    // Ks e Ns: override dal parametro passato a loadOBJ.
    // Necessario perché alcuni MTL hanno Ks=0 anche per materiali metallici (es. forbici)
    // (nessun riflesso speculare) per default, rendendo tutti i materiali opachi.
    gl.uniform3fv(gl.getUniformLocation(mainProg,'u_Ks'), obj.mat.Ks);
    gl.uniform1f (gl.getUniformLocation(mainProg,'u_Ns'), obj.mat.Ns);

    // Salta materiali completamente trasparenti (d=0 nel MTL, es. vetro perfetto)
    // altrimenti verrebbero disegnati come superfici quasi invisibili che pero’ 
    // scriverebbero nel depth buffer, causando artefatti.
    if (obj.mesh && obj.mesh.materials[group.matIdx]) {
      const d = obj.mesh.materials[group.matIdx].parameter.get('d');
      if (d !== undefined && d < 0.1) return;
    }

    // Nome del materiale per cercare eventuali texture per-materiale
    const matName = (obj.mesh && obj.mesh.materials[group.matIdx])
      ? obj.mesh.materials[group.matIdx].name : '';
    const perMatTexForGroup = obj.perMatTex && obj.perMatTex[matName];
    const hasMapKd = obj.mesh && obj.mesh.materials[group.matIdx] &&
      !!obj.mesh.materials[group.matIdx].parameter.get('map_Kd');

    const Kd      = group.Kd || obj.mat.Kd;
    const isBlack = group.Kd && Kd[0] < 0.05 && Kd[1] < 0.05 && Kd[2] < 0.05;

    if (isBlack) {
      // Materiale quasi-nero: scritta o dettaglio scuro 
      // Esempio: testo sul tavolo
      // Nota: risolve problema di scritta non visibile sul tavolo e sedia
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
      gl.uniform1i (gl.getUniformLocation(mainProg,'u_texture'),    0);
      gl.uniform1f (gl.getUniformLocation(mainProg,'u_useTexture'), 0.0);
      gl.uniform3fv(gl.getUniformLocation(mainProg,'u_Kd'), [0.02,0.02,0.02]);
    } else if (perMatTexForGroup) {
      // Texture specifica per questo materiale (Esempio: foto sulla testa del manichino)
      // Nota: risolve problema di img foto non renderizzata correttamente sul manichino
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, perMatTexForGroup);
      gl.uniform1i (gl.getUniformLocation(mainProg,'u_texture'),    0);
      gl.uniform1f (gl.getUniformLocation(mainProg,'u_useTexture'), 1.0);
      gl.uniform3fv(gl.getUniformLocation(mainProg,'u_Kd'), [0.8,0.8,0.8]);
    } else if (hasMapKd && obj.texture instanceof WebGLTexture) {
      // Materiale con map_Kd nel MTL: usa la texture globale dell'oggetto
      // Esempio: sasso
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, obj.texture);
      gl.uniform1i (gl.getUniformLocation(mainProg,'u_texture'),    0);
      gl.uniform1f (gl.getUniformLocation(mainProg,'u_useTexture'), 1.0);
      gl.uniform3fv(gl.getUniformLocation(mainProg,'u_Kd'), [1,1,1]);
    } else if (obj.texture instanceof WebGLTexture) {
      // Texture globale disponibile ma il MTL non ha map_Kd
      // Esempio: pianta
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, obj.texture);
      gl.uniform1i (gl.getUniformLocation(mainProg,'u_texture'),    0);
      gl.uniform1f (gl.getUniformLocation(mainProg,'u_useTexture'), 1.0);
      gl.uniform3fv(gl.getUniformLocation(mainProg,'u_Kd'), Kd);
    } else {
      // Nessuna texture: usa solo il colore Kd del materiale senza campionare texture
      // Esempio: stack di fogli
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
      gl.uniform1i (gl.getUniformLocation(mainProg,'u_texture'),    0);
      gl.uniform1f (gl.getUniformLocation(mainProg,'u_useTexture'), 0.0);
      gl.uniform3fv(gl.getUniformLocation(mainProg,'u_Kd'), Kd);
    }

    gl.drawArrays(gl.TRIANGLES, 0, group.count);
  });
}