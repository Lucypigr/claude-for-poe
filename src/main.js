import { Game } from './core/Game.js';
import { seedInventoryFixture } from './items/fixtures.js';

const game = new Game({
  worldContainer: document.getElementById('world'),
  uiContainer: document.getElementById('ui'),
});
// TEST FIXTURE: there are no drops yet, so the bag starts with tagged sample
// items (data.fixture = true) to exercise the grid UI.
seedInventoryFixture(game.inventory);
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
