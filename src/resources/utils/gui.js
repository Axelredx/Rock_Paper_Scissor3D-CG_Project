// =============================================================
// gui.js — Pannello di controllo dat.GUI
//
// Crea il pannello in alto a destra con i parametri modificabili
// in tempo reale: intensità luce, luce ambiente, ombre, modalità gioco.
// =============================================================

function initGUI() {
  const gui = new dat.GUI({ width: 250 });

  // Intensità della luce puntuale (0 = buio, 2 = molto luminoso)
  gui.add(params, 'lightIntensity', 0, 2, 0.05).name('Intensità luce');

  // Intensità della luce ambiente (0 = nessuna, 0.8 = molto diffusa)
  gui.add(params, 'ambientIntensity', 0, 0.8, 0.02).name('Luce ambiente');

  // Toggle ombre: passa u_shadowsEnabled=1/0 allo shader ad ogni frame
  gui.add(params, 'shadows').name('Ombre');

  // Modalità gioco: mostra/nasconde il pannello HTML dei tasti RPS
  gui.add(params, 'playGame').name('Modalità Gioco').onChange(v => {
    document.getElementById('rps-panel').style.display = v ? 'flex' : 'none';
    if (!v) {
      // Nasconde e resetta il risultato quando si esce dalla modalità gioco
      const el = document.getElementById('rps-result');
      el.style.display = 'none';
      el.innerHTML = '';
    }
    // Aggiorna la posizione del d-pad mobile (se presente)
    if (window.updateMobileControlsPos) window.updateMobileControlsPos();
  });
}