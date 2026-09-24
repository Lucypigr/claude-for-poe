import { Game } from './core/Game.js';

const game = new Game({
  worldContainer: document.getElementById('world'),
  uiContainer: document.getElementById('ui'),
});
game.start();

if (import.meta.env.DEV) {
  // Dev-only inspection hook for manual/automated checks.
  const debug = { worldPointerCount: 0 };
  game.input.onWorldPointer(() => debug.worldPointerCount++);
  window.__game = { game, debug };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
