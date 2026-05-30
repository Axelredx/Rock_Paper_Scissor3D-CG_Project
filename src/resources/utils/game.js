// =============================================================
// game.js — Logica del gioco Sasso Carta Forbici + controlli mobile
//
// Contiene:
//   - playRPS: gestisce una partita, mostra il risultato per 2 secondi
//   - setupMobileBtn: collega i pulsanti touch al dizionario keys[]
//   - updateMobileControlsPos: aggiusta la posizione del d-pad
//   - updateMobileVisibility: mostra/nasconde i controlli in base alla larghezza
// =============================================================

// --- Sasso Carta Forbici ---

let rpsTimer = null;

// Esegue una partita: sceglie casualmente la mossa dell'avversario,
// determina l'esito e lo mostra per 2 secondi.
function playRPS(mossa) {
  const mosse = ['sasso', 'carta', 'forbici'];
  // Sceglie una mossa casuale per l'avversario tra 0, 1, 2
  const avv   = mosse[Math.floor(Math.random() * 3)];

  let esito;
  if (mossa === avv) {
    esito = '🤷 Pareggio!';
  } else if (
    (mossa === 'sasso'   && avv === 'forbici') ||
    (mossa === 'carta'   && avv === 'sasso')   ||
    (mossa === 'forbici' && avv === 'carta')
  ) {
    esito = '🏆 Vittoria!';
  } else {
    esito = '💀 Sconfitta!';
  }

  // Si mostra il risultato su due righe per evitare overflow su mobile
  const el = document.getElementById('rps-result');
  // Si usa innerHTML per inserire un <br> tra avversario ed esito
  el.innerHTML = 'Mossa avversario: ' + avv + '<br>' + esito;
  el.style.display = 'block';

  // Auto-nasconde dopo 2 secondi (+ cancella un eventuale timer precedente)
  if (rpsTimer) clearTimeout(rpsTimer);
  rpsTimer = setTimeout(() => {
    el.style.display = 'none';
    el.innerHTML = '';
  }, 2000);
}

// --- Controlli mobile ---

// Restituisce true se lo schermo è considerato mobile (larghezza <= 768px)
function isMobile() {
  return window.innerWidth <= 768;
}

// Mappa id-pulsante -> codice tasto da simulare nel dizionario keys[] (globals.js)
// Nota: WASD per movimento lungo asse XZ e QE per movimento su asse Y
const MOB_MAP = {
  'btn-w': 'KeyW', 'btn-s': 'KeyS',
  'btn-a': 'KeyA', 'btn-d': 'KeyD',
  'btn-q': 'KeyQ', 'btn-e': 'KeyE'
};

// Collega gli eventi touch di un pulsante al dizionario keys[]:
// touchstart -> keys[code]=true, touchend/cancel -> keys[code]=false
function setupMobileBtn(id) {
  const btn  = document.getElementById(id);
  const code = MOB_MAP[id];
  if (!btn) return;

  btn.addEventListener('touchstart', e => {
    // impedisce doppio tocco (zoom) o scroll involontario
    e.preventDefault();
    if (window.keys) window.keys[code] = true;
  }, { passive: false });

  const stop = e => {
    e.preventDefault();
    if (window.keys) window.keys[code] = false;
  };
  btn.addEventListener('touchend',    stop, { passive: false });
  btn.addEventListener('touchcancel', stop, { passive: false });
}

// Aggiusta la posizione verticale del d-pad (tasti a schermo per il movimento su mobile):
// se il pannello RPS è visibile su mobile, il d-pad sale per non sovrapporsi
function updateMobileControlsPos() {
  const mc  = document.getElementById('mobile-controls');
  const rps = document.getElementById('rps-panel');
  if (!mc || !rps) return;
  const rpsVisible = rps.style.display === 'flex';
  rps.style.bottom = '18px'; // RPS sempre in basso fisso
  mc.style.bottom  = (rpsVisible && isMobile()) ? '90px' : '18px';
}

// Mostra/nasconde il d-pad in base alla larghezza dello schermo.
// Chiamata al load e ad ogni resize (es. rotazione del telefono).
function updateMobileVisibility() {
  const mc = document.getElementById('mobile-controls');
  if (!mc) return;
  mc.style.display = isMobile() ? 'flex' : 'none';
  if (isMobile()) updateMobileControlsPos();
}

// Inizializzazione al caricamento della pagina
window.addEventListener('load', () => {
  updateMobileVisibility();
  Object.keys(MOB_MAP).forEach(setupMobileBtn);
});

// Aggiorna visibilità se la finestra viene ridimensionata
window.addEventListener('resize', updateMobileVisibility);

// Esposto globalmente per essere chiamato dall'onChange della GUI in gui.js
window.updateMobileControlsPos = updateMobileControlsPos;