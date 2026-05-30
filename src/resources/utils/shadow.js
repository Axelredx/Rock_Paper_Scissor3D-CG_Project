// =============================================================
// shadow.js — Shadow mapping: matrici della luce e depth pass
//
// Il shadow mapping si svolge in due passate:
//   1) Depth pass (drawSceneDepth): renderizza la scena dal punto
//      di vista della luce per costruire la shadow map.
//   2) Render pass (in main.js): usa la shadow map per determinare
//      quali frammenti sono in ombra.
// =============================================================

// Calcola le matrici della luce per la shadow map.
// Restituisce { lightView, lightProj }.
function getLightMatrices() {
  // posizione della luce (parete est, in alto)
  const lightPos    = [9, 6, 0];  
  // guarda verso il basso-centro: ombre meno oblique (e meno staccate)
  const lightTarget = [0, -3, 0]; 
  // vettore up verso nord e quindi perpendicolare alla view 
  // (evita gimbal lock = sovrapposizione con la direzione di vista)
  const lightUp     = [0, 0, -1]; 

  // View matrix della luce: trasforma dal world space allo spazio della luce
  const lightView = m4.inverse(m4.lookAt(lightPos, lightTarget, lightUp));

  // Proiezione ortografica: raggi paralleli (no distorsione prospettica come nella vista).
  // I valori [-15, 15] coprono la stanza 20x20 con un po' di margine (30x30).
  const lightProj = m4.orthographic(-15, 15, -15, 15, 0.1, 25);

  return { lightView, lightProj };
}

// Passata 1 - Depth pass: disegna solo la geometria degli oggetti dal punto 
// di vista della luce. Il risultato viene salvato nella depth texture del shadowFBO 
// e poi confrontato nella Passata 2 per determinare le ombre.
function drawSceneDepth(lightView, lightProj) {
  gl.useProgram(depthProg);
  const _pos = gl.getAttribLocation(depthProg, 'a_position');
  gl.uniformMatrix4fv(gl.getUniformLocation(depthProg, 'u_Pmatrix'), false, lightProj);
  gl.uniformMatrix4fv(gl.getUniformLocation(depthProg, 'u_Vmatrix'), false, lightView);

  // Finestre e porta hanno noCastShadow=true: essendo incassate nella parete
  // non devono proiettare ombre sugli oggetti interni alla stanza
  sceneObjects.forEach(obj => {
    if (obj.noCastShadow) return;
    gl.uniformMatrix4fv(gl.getUniformLocation(depthProg, 'u_Mmatrix'), false, obj.modelMatrix);
    obj.buffers.forEach(group => {
      gl.bindBuffer(gl.ARRAY_BUFFER, group.vb);
      gl.vertexAttribPointer(_pos, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(_pos);
      gl.drawArrays(gl.TRIANGLES, 0, group.count);
    });
  });

  // Nota: NON si includono le pareti Le pareti sono l’involucro della stanza vista 
  // dall’interno. La luce e’ dentro la stanza. Se includessimo le pareti, la luce 
  // “vedrebbe” il retro delle pareti come occlusori, proiettando ombre su tutto l’interno!
}