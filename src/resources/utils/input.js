// =============================================================
// input.js — Gestione input: tastiera, mouse, touch
//
// initInput:   registra tutti gli event listener sul canvas.
// updateInput: aggiorna TARGET (posizione camera) ogni frame.
// =============================================================

// Registra gli event listener per tastiera, mouse e touch.
function initInput(canvas) {

  // --- Tastiera ---
  // Salva lo stato dei tasti in keys[] per poterli leggere ogni frame in updateInput
  window.addEventListener('keydown', e => keys[e.code] = true);
  window.addEventListener('keyup',   e => keys[e.code] = false);

  // --- Mouse ---
  // Drag: orbita la camera attorno al TARGET modificando THETA (azimuth) e PHI (elevazione)
  // Scroll: zoom avvicinando/allontanando la camera (modifica D)
  let drag = false, ox, oy;
  canvas.addEventListener('mousedown', e => { drag=true; ox=e.pageX; oy=e.pageY; e.preventDefault(); });
  window.addEventListener('mouseup',   () => drag=false);
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    THETA -= (e.pageX-ox) * 2*Math.PI / canvas.width;
    PHI   -= (e.pageY-oy) * 2*Math.PI / canvas.height;
    PHI    = Math.max(0.05, Math.min(Math.PI-0.05, PHI)); // clamp per non passare ai poli
    ox=e.pageX; oy=e.pageY;
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    D = Math.max(1, Math.min(18, D + e.deltaY*0.01));
  }, { passive: false });

  // --- Touch ---
  // 1 dito: orbita camera (stesso comportamento del mouse drag)
  // 2 dita: pinch zoom (confronta distanza tra i tocchi tra frame successivi)
  let lt = null; // posizioni touch del frame precedente
  canvas.addEventListener('touchstart', e => {
    e.preventDefault(); lt=e.touches;
    if (e.touches.length===1) { drag=true; ox=e.touches[0].pageX; oy=e.touches[0].pageY; }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length===1 && drag) {
      // Nota: per convenzione scelta (mondo ruota nella direzione del trascinamento),
      //      al diminuire di THETA la camera ruota a dx
      THETA -= (e.touches[0].pageX-ox) * 2*Math.PI / canvas.width;
      PHI   -= (e.touches[0].pageY-oy) * 2*Math.PI / canvas.height;
      PHI    = Math.max(0.05, Math.min(Math.PI-0.05, PHI));
      ox=e.touches[0].pageX; oy=e.touches[0].pageY;
    } else if (e.touches.length===2 && lt && lt.length===2) {
      // Pinch: confronta la distanza tra i 2 tocchi nel frame precedente e attuale
      const prev = Math.hypot(lt[1].pageX-lt[0].pageX,   lt[1].pageY-lt[0].pageY);
      const curr = Math.hypot(e.touches[1].pageX-e.touches[0].pageX, e.touches[1].pageY-e.touches[0].pageY);
      D = Math.max(1, Math.min(18, D + (prev-curr)*0.05));
    }
    lt=e.touches;
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault(); if (e.touches.length===0) drag=false; lt=e.touches;
  }, { passive: false });
}

// Aggiorna la posizione del TARGET della camera in base ai tasti premuti.
// Chiamata ogni frame con dt (delta time in secondi).
function updateInput(dt) {
  // movimento di 5 unità al secondo (stanza 20x20)
  const spd = 5*dt;
  if (keys['KeyW']||keys['ArrowUp'])    TARGET[2] -= spd; // avanti (nord)
  if (keys['KeyS']||keys['ArrowDown'])  TARGET[2] += spd; // indietro (sud)
  if (keys['KeyA']||keys['ArrowLeft'])  TARGET[0] -= spd; // sinistra (ovest)
  if (keys['KeyD']||keys['ArrowRight']) TARGET[0] += spd; // destra (est)
  if (keys['KeyQ'])                     TARGET[1] += spd; // su
  if (keys['KeyE'])                     TARGET[1] -= spd; // giù
  // Clamp: mantiene il TARGET dentro i limiti della stanza
  // Nota: per quanto riguarda il movimento della telecamera lungo gli assi, 
  //        i limiti sono scelti in modo da fermarsi prima delle pareti; ma se si modifica
  //        la direzione della telecamera (punto di vista) si oltrepassano comunque le pareti
  TARGET[0] = Math.max(-9, Math.min(9, TARGET[0]));
  TARGET[1] = Math.max(0,  Math.min(6, TARGET[1]));
  TARGET[2] = Math.max(-9, Math.min(9, TARGET[2]));
}