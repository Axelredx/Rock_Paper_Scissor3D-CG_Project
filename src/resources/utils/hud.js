// =============================================================
// hud.js — HUD 2D: titolo disegnato su canvas sovrapposto
//
// Usa un secondo canvas 2D (#hud) sovrapposto al canvas WebGL
// per disegnare elementi UI come il titolo del gioco.
// =============================================================

// Disegna il titolo "ROCK - PAPER - SCISSORS 3D" centrato in alto
function drawHUD() {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const ctx = hud.getContext('2d');
  ctx.clearRect(0, 0, hud.width, hud.height);

  const title = 'ROCK - PAPER - SCISSORS 3D';
  ctx.font = 'bold 15px monospace';
  const tw = ctx.measureText(title).width;
  const tx = (hud.width - tw) / 2;

  // Sfondo nero con angoli arrotondati
  ctx.fillStyle = '#000';
  rrect(ctx, tx-14, 13, tw+28, 34, 7);
  ctx.fill();

  // Testo bianco
  ctx.fillStyle = '#fff';
  ctx.fillText(title, tx, 37);
}

// Utility: disegna un rettangolo con angoli arrotondati di raggio r
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);     ctx.lineTo(x+w-r, y);   ctx.arcTo(x+w, y,   x+w, y+r,   r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);   ctx.arcTo(x,   y+h, x,   y+h-r, r);
  ctx.lineTo(x,   y+r);   ctx.arcTo(x,   y,   x+r, y,     r);
  ctx.closePath();
}