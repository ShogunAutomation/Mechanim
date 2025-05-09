import * as gameState from './gameState.js';

export class GameObject {
  constructor(x, y, w, h, type, faction) {
    Object.assign(this, {
      x,
      y,
      w,
      h,
      type,
      faction,
      health: 100,
      maxHealth: 100,
      damage: 10,
      range: 100,
      cooldown: 0,
      aspd: 1,
      speed: 0,
      target: null,
      remove: false,
    });
  }
  
  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.target || this.target.remove) this.acquireTarget();
    if (this.target) {
      const dx = this.target.x - this.x,
        dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= this.range) {
        if (this.cooldown <= 0) {
          this.target.takeDamage(this.damage);
          this.cooldown = 1 / this.aspd;
          this.spawnEffect(this.target);
          this.spawnProjectile(this.target); // Add projectile effect
        }
      } else if (this.speed > 0) {
        // Separation mechanic to prevent clumping
        const separation = this.calculateSeparation();
        this.x += ((dx / dist) + separation.x) * this.speed * dt;
        this.y += ((dy / dist) + separation.y) * this.speed * dt;
      }
    }
  }
  
  acquireTarget() {
    let minD = Infinity,
      best = null;
    
    // Fix: Use gameState.getGameObjects() instead of window.gameObjects
    const gameObjects = gameState.getGameObjects();
    if (!gameObjects) {
      console.error("Game objects array is undefined");
      return; // Prevent the forEach error
    }
    
    gameObjects.forEach((o) => {
      if (o.faction === this.faction || o.remove) return;
      let d = Math.hypot(o.x - this.x, o.y - this.y);
      if (o.type === "hq") d *= 0.5;
      if (d < minD) {
        minD = d;
        best = o;
      }
    });
    this.target = best;
  }
  
  spawnEffect(tgt) {
    gameState.addParticle(
      new Particle(
        this.x + this.w / 2,
        this.y + this.h / 2,
        tgt.x + tgt.w / 2,
        tgt.y + tgt.h / 2,
        this.faction === "player" ? "#60f0ff" : "#ff6060"
      )
    );
  }
  
  takeDamage(amount) {
    this.health -= amount;
    this.showDamage(amount);
    if (this.health <= 0) {
      this.remove = true;
      if (this.type !== "hq" && this.type !== "obelisk") {
        if (this.faction === "player") {
          gameState.set('playerMechs', gameState.get('playerMechs') - 1);
        } else {
          gameState.set('enemyMechs', gameState.get('enemyMechs') - 1);
        }
      }
      if (this.type === "hq") {
        // End the game when an HQ is destroyed
        const playerLost = this.faction === "player";
        gameState.set('gameRunning', false);
        document.getElementById("end-message").textContent = playerLost ? "DEFEAT" : "VICTORY";
        document.getElementById("end-screen").style.display = "flex";
      }
    }
  }
  
  showDamage(amount) {
    const et = document.createElement("div");
    et.className = "effect-text";
    et.textContent = `-${amount}`;
    et.style.left = `${this.x + this.w / 2}px`;
    et.style.top = `${this.y}px`;
    document.getElementById("battlefield").appendChild(et);
    setTimeout(() => et.remove(), 1500);
  }
  
  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) {
      console.error("Canvas context is undefined");
      return;
    }
    
    // Differentiate unit types visually with shapes
    if (this.type === "unit") {
      ctx.fillStyle = this.subtype === "basic" 
        ? (this.faction === "player" ? "#4080ff" : "#ff4040") 
        : (this.faction === "player" ? "#204080" : "#802020");
      
      if (this.subtype === "basic") {
        // Draw a rectangle for basic units
        ctx.fillRect(this.x, this.y, this.w, this.h);
      } else if (this.subtype === "tank") {
        // Draw a circle for tank units
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Default shape for other types
      ctx.fillStyle = this.faction === "player" ? "#4080ff" : "#ff4040";
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
    
    // health bar
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w, 4);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w * pct, 4);
  }

  // Add a method to calculate separation force
  calculateSeparation() {
    const separationForce = { x: 0, y: 0 };
    const neighbors = gameState.getGameObjects().filter(
      (o) => o !== this && o.faction === this.faction && !o.remove
    );

    neighbors.forEach((neighbor) => {
      const dx = this.x - neighbor.x;
      const dy = this.y - neighbor.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 50) { // Separation threshold
        separationForce.x += dx / dist;
        separationForce.y += dy / dist;
      }
    });

    return separationForce;
  }

  spawnProjectile(tgt) {
    gameState.addParticle(
      new Particle(
        this.x + this.w / 2,
        this.y + this.h / 2,
        tgt.x + tgt.w / 2,
        tgt.y + tgt.h / 2,
        this.faction === "player" ? "#60f0ff" : "#ff6060",
        0.3 // Shorter duration for projectiles
      )
    );
  }
}

export class Headquarters extends GameObject {
  constructor(x, y, f) {
    super(x, y, 80, 80, "hq", f);
    this.health = this.maxHealth = 500;
    this.range = 200;
    this.damage = 15;
    this.aspd = 0.5;
    this.spawnPoint = { x: x + (f === "player" ? 100 : -60), y: y + 40 };
  }
  
  update(dt) {
    super.update(dt);
    
    const spawnCd = this.faction === "player" ? 
      gameState.get('spawnCooldown') : 
      gameState.get('enemySpawnCooldown');
    
    if (spawnCd <= 0) {
      this.spawnUnit();
      if (this.faction === "player") {
        gameState.set('spawnCooldown', gameState.getConfig('SPAWN_CD'));
      } else {
        gameState.set('enemySpawnCooldown', gameState.getConfig('SPAWN_CD'));
      }
    }
  }
  
  spawnUnit() {
    const u = new Mech(
      this.spawnPoint.x,
      this.spawnPoint.y,
      "basic",
      this.faction
    );
    gameState.addGameObject(u);
    
    if (this.faction === "player") {
      gameState.set('playerMechs', gameState.get('playerMechs') + 1);
    } else {
      gameState.set('enemyMechs', gameState.get('enemyMechs') + 1);
    }
    
    gameState.addParticle(
      new Particle(
        this.spawnPoint.x,
        this.spawnPoint.y,
        this.spawnPoint.x,
        this.spawnPoint.y,
        this.faction === "player" ? "#60f0ff" : "#ff6060",
        0.4
      )
    );
  }
  
  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) {
      console.error("Canvas context is undefined");
      return;
    }
    
    // gradient body
    const grad = ctx.createRadialGradient(
      this.x + 40,
      this.y + 40,
      10,
      this.x + 40,
      this.y + 40,
      50
    );
    grad.addColorStop(0, this.faction === "player" ? "#80c0ff" : "#ff8080");
    grad.addColorStop(1, this.faction === "player" ? "#2040a0" : "#a02020");
    ctx.fillStyle = grad;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // border
    ctx.strokeStyle = this.faction === "player" ? "#60f0ff" : "#ff6060";
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    // health bar
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + 82, this.w, 6);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + 82, this.w * pct, 6);
  }
}

export class Mech extends GameObject {
  constructor(x, y, subtype, f) {
    super(x, y, 40, 40, "unit", f);
    this.subtype = subtype;
    switch (subtype) {
      case "basic":
        this.health = 80;
        this.maxHealth = 80;
        this.damage = 15;
        this.range = 150;
        this.speed = 60;
        this.aspd = 0.8;
        break;
      case "tank":
        this.health = 200;
        this.maxHealth = 200;
        this.damage = 30;
        this.range = 120;
        this.speed = 40;
        this.aspd = 0.5;
        break;
    }
  }
  
  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) {
      console.error("Canvas context is undefined");
      return;
    }
    
    // Differentiate unit types visually with shapes
    if (this.type === "unit") {
      ctx.fillStyle = this.subtype === "basic" 
        ? (this.faction === "player" ? "#4080ff" : "#ff4040") 
        : (this.faction === "player" ? "#204080" : "#802020");
      
      if (this.subtype === "basic") {
        // Draw a rectangle for basic units
        ctx.fillRect(this.x, this.y, this.w, this.h);
      } else if (this.subtype === "tank") {
        // Draw a circle for tank units
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Default shape for other types
      ctx.fillStyle = this.faction === "player" ? "#4080ff" : "#ff4040";
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + 42, this.w, 4);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + 42, this.w * pct, 4);
  }
}

export class Obelisk extends GameObject {
  constructor(x, y) {
    super(x, y, 50, 50, "obelisk", "neutral");
    this.capture = 0; // -1..1
  }
  
  update(dt) {
    super.update(dt);
    ["player", "enemy"].forEach((f) => {
      const inRange = gameState.getGameObjects().some(
        (o) =>
          o.faction === f &&
          Math.hypot(o.x - this.x, o.y - this.y) < gameState.getConfig('CAPTURE_DIST')
      );
      if (inRange) {
        this.capture += (f === "player" ? gameState.getConfig('CAPTURE_RATE') : -gameState.getConfig('CAPTURE_RATE')) * dt;
        this.capture = Math.max(-1, Math.min(1, this.capture));
      }
    });
    if (Math.abs(this.capture) >= 1 && this.faction === "neutral") {
      this.faction = this.capture > 0 ? "player" : "enemy";
      if (this.faction === "player") gameState.set('playerMechs', gameState.get('playerMechs') + 1);
      else gameState.set('enemyMechs', gameState.get('enemyMechs') + 1);
    }
  }
  
  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) {
      console.error("Canvas context is undefined");
      return;
    }
    
    ctx.fillStyle =
      this.faction === "neutral"
        ? "#888"
        : this.faction === "player"
          ? "#60f0ff"
          : "#ff6060";
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // progress bar
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + 52, this.w, 4);
    const wProg = ((this.capture + 1) / 2) * this.w;
    ctx.fillStyle = this.capture > 0 ? "#2f2" : "#f22";
    ctx.fillRect(this.x, this.y + 52, wProg, 4);
  }
}

export class Particle {
  constructor(x1, y1, x2, y2, color, dur = 0.2) {
    Object.assign(this, { x1, y1, x2, y2, color, time: 0, dur });
  }
  
  update(dt) {
    this.time += dt;
    return this.time < this.dur;
  }
  
  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) {
      console.error("Canvas context is undefined");
      return;
    }
    
    const t = this.time / this.dur;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3; // Thicker line for better visibility
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(
      this.x1 + (this.x2 - this.x1) * t,
      this.y1 + (this.y2 - this.y1) * t
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
