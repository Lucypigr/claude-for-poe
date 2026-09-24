import { Game } from './core/Game.js';
import { seedInventoryFixture } from './items/fixtures.js';

const game = new Game({
  worldContainer: document.getElementById('world'),
  uiContainer: document.getElementById('ui'),
});
// The bag starts empty; items come from enemy drops picked up off the ground.
game.start();

if (import.meta.env.DEV) {
  // Dev-only inspection hook for manual/automated checks. seedFixture() is an
  // explicit dev tool that fills the bag with the tagged test fixture
  // (data.fixture = true); it is never called on startup and is not a drop.
  const debug = { worldPointerCount: 0, seedFixture: () => seedInventoryFixture(game.inventory) };
  game.input.onWorldPointer(() => debug.worldPointerCount++);
  window.__game = { game, debug };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
