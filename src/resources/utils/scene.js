// =============================================================
// scene.js — Posizionamento degli oggetti nella scena e animazioni
//
// loadSceneObjects: carica tutti i modelli OBJ con posizione e materiale.
// updateAnimations: aggiorna ogni frame la modelMatrix degli oggetti animati.
// =============================================================

// Carica tutti gli oggetti della scena in ordine.
// Nota: Ogni loadOBJ è await per garantire che il parsing sia completato
//        prima di salvare il riferimento in objRock/objScissors/objPaper/etc.
async function loadSceneObjects() {
  const base = 'resources/assets/final-models/';

  // Tavolo al centro della stanza
  await loadOBJ(base+'table/table.obj', base+'table/WoodFloor040_1K-JPG_Color.jpg',
    buildModelMatrix([0,0,0], 0, [1.8,1.8,1.8]),
    { Kd:[0.85,0.72,0.5], Ks:[0.15,0.15,0.1], Ns:32 });

  // Sedia davanti al tavolo, girata verso nord (verso il manichino)
  await loadOBJ(base+'chair/chair.obj', base+'chair/WoodFloor040_1K-JPG_Color.jpg',
    buildModelMatrix([0,0,2.2], Math.PI/2, [1,1,1]),
    { Kd:[0.85,0.72,0.5], Ks:[0.15,0.15,0.1], Ns:32 });

  // Manichino: texture per-materiale — solo Material.001 (testa) riceve la foto
  // (il resto del corpo è colorato con Kd grigio chiaro, leggermente brillante)
  await loadOBJ(base+'dummy/full-dummy.obj', null,
    buildModelMatrix([0,0,-3.2], 0, [1.6,1.6,1.6]),
    { Kd:[0.6,0.6,0.62], Ks:[0.15,0.15,0.15], Ns:32 },
    { 'Material.001': base+'dummy/mia-foto.jpg' });

  // --- Oggetti animati sul tavolo ---

  // Sasso (sinistra) — ruota attorno a Z
  await loadOBJ(base+'rock/rock.obj', base+'rock/Rock060_1K-JPG_Color.jpg',
    buildModelMatrix([-1,TABLE_TOP_Y,0], 0, [0.35,0.35,0.35]),
    { Kd:[0.6,0.6,0.6], Ks:[0.1,0.1,0.1], Ns:8 });
  objRock = sceneObjects[sceneObjects.length-1];

  // Forbici (centro) — Ks alto per effetto metallico lucido
  await loadOBJ(base+'scissors/scissors.obj', base+'scissors/Metal055A_1K-JPG_Color.jpg',
    buildModelMatrix([0,TABLE_TOP_Y,0], 0, [0.35,0.35,0.35]),
    { Kd:[0.75,0.78,0.82], Ks:[0.9,0.9,0.95], Ns:256 });
  objScissors = sceneObjects[sceneObjects.length-1];

  // Stack di fogli (destra) — ruota attorno a X
  await loadOBJ(base+'stack-of-paper/model.obj', null,
    buildModelMatrix([1,TABLE_TOP_Y,0], 0, [0.2,0.2,0.2]),
    { Kd:[1,1,1], Ks:[0.05,0.05,0.05], Ns:4 });
  objPaper = sceneObjects[sceneObjects.length-1];

  // --- Finestre ---
  // Nota: noCastShadow=true: non proiettano ombra nella scena (incassonate nella parete)

  // Parete est (x=+9): 2 finestre simmetriche rispetto al centro
  await loadOBJ(base+'window/model.obj', null,
    buildModelMatrix([9.9,3,-3], Math.PI/2, [1.5,1.5,1.5]),
    { Kd:[0.9,0.85,0.7], Ks:[0.3,0.3,0.3], Ns:64 });
  sceneObjects[sceneObjects.length-1].noCastShadow = true;

  await loadOBJ(base+'window/model.obj', null,
    buildModelMatrix([9.9,3,3], Math.PI/2, [1.5,1.5,1.5]),
    { Kd:[0.9,0.85,0.7], Ks:[0.3,0.3,0.3], Ns:64 });
  sceneObjects[sceneObjects.length-1].noCastShadow = true;

  // Parete nord (z=-9): 1 finestra centrale
  await loadOBJ(base+'window/model.obj', null,
    buildModelMatrix([0,3,-9.9], Math.PI, [1.5,1.5,1.5]),
    { Kd:[0.9,0.85,0.7], Ks:[0.3,0.3,0.3], Ns:64 });
  sceneObjects[sceneObjects.length-1].noCastShadow = true;

  // Porta (parete ovest, x=-9): 
  // Nota: matrice costruita manualmente per posizionarla
  // a filo del muro (translate + yRotate + scale) nell'ordine corretto!
  {
    let Mdoor = m4.translate(m4.identity(), -9.9, 0, 0);
    Mdoor = m4.yRotate(Mdoor, Math.PI/2);
    Mdoor = m4.scale(Mdoor, 2, 2, 2);
    await loadOBJ(base+'door/doorway.obj', null, Mdoor,
      { Kd:[0.7,0.5,0.3], Ks:[0.1,0.1,0.1], Ns:16 });
    sceneObjects[sceneObjects.length-1].noCastShadow = true;
  }

  // Piante negli angoli nord-est e nord-ovest
  await loadOBJ(base+'plant/Houseplant.obj', base+'plant/Houseplant_BaseColor.png',
    buildModelMatrix([7.5,0,-7.5], 0, [1.2,1.2,1.2]),
    { Kd:[0.4,0.7,0.3], Ks:[0.05,0.05,0.05], Ns:8 });

  await loadOBJ(base+'plant/Houseplant.obj', base+'plant/Houseplant_BaseColor.png',
    buildModelMatrix([-7.5,0,-7.5], 0, [1.2,1.2,1.2]),
    { Kd:[0.4,0.7,0.3], Ks:[0.05,0.05,0.05], Ns:8 });
}

// Aggiorna ogni frame la modelMatrix degli oggetti animati sul tavolo.
//
// Ciascun oggetto levita (sin) e ruota attorno a un asse diverso.
// Nota: si usa il sin() poichè funzione periodica che oscilla tra [-1,1]
//
// Nota: Le fasi (0, 2pi/3, 4pi/3) li sfasano tra loro in modo che non
//      raggiungano mai il picco tutti nello stesso momento (piccolezza per rendere
//      l'animazione più piacevole).
function updateAnimations(dt) {
  animTime += dt * FLOAT_SPEED;

  // Sasso: levita + ruota attorno a Z (asse orizzontale)
  if (objRock) {
    const y = TABLE_TOP_Y + Math.sin(animTime) * FLOAT_AMPLITUDE;
    let M = m4.translate(m4.identity(), -1, y, 0);
    M = m4.zRotate(M, animTime * 0.6);
    M = m4.scale(M, 0.28, 0.28, 0.28);
    objRock.modelMatrix = M;
  }

  // Forbici: levita + ruota attorno a Y (asse verticale)
  if (objScissors) {
    const y = TABLE_TOP_Y + Math.sin(animTime + 2.09) * FLOAT_AMPLITUDE;
    let M = m4.translate(m4.identity(), 0, y, 0);
    M = m4.yRotate(M, animTime * 0.8);
    M = m4.scale(M, 0.35, 0.35, 0.35);
    objScissors.modelMatrix = M;
  }

  // Stack di fogli: levita + ruota attorno a X (asse di profondità)
  if (objPaper) {
    const y = TABLE_TOP_Y + Math.sin(animTime + 4.19) * FLOAT_AMPLITUDE;
    let M = m4.translate(m4.identity(), 1, y, 0);
    M = m4.xRotate(M, animTime * 0.5);
    M = m4.scale(M, 0.2, 0.2, 0.2);
    objPaper.modelMatrix = M;
  }
}