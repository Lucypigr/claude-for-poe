// Hit points shared by the player and enemies.
export class Health {
  constructor(max) {
    this.max = max;
    this.current = max;
  }

  get dead() {
    return this.current <= 0;
  }

  get ratio() {
    return this.max > 0 ? Math.max(0, this.current) / this.max : 0;
  }

  // Returns the damage actually dealt (0 when already dead or amount <= 0).
  damage(amount) {
    if (this.dead || !(amount > 0)) return 0;
    const dealt = Math.min(amount, this.current);
    this.current -= dealt;
    return dealt;
  }

  reset() {
    this.current = this.max;
  }
}
