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
      shield: 0, // Add shield property for protection mechanics
    });
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.target || this.target.remove) this.acquireTarget();
    if (this.target) {
      // Prevent attacking obelisks, only move toward them for capture
      if (this.target.type === "obelisk") {
        const dx = this.target.x - this.x,
              dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (this.speed > 0 && dist > 5) { // Move close, but don't attack
          const separation = this.calculateSeparation();
          this.x += ((dx / dist) + separation.x) * this.speed * dt;
          this.y += ((dy / dist) + separation.y) * this.speed * dt;
        }
        return;
      }
      // ...existing code for attacking/moving to other targets...
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
        const separation = this.calculateSeparation();
        this.x += ((dx / dist) + separation.x) * this.speed * dt;
        this.y += ((dy / dist) + separation.y) * this.speed * dt;
      }
    }
  }

  acquireTarget() {
    // Only units (not structures/HQs/obelisk) use this logic
    if (this.type !== "unit") return;
    const gameObjects = gameState.getGameObjects();
    if (!gameObjects) return;

    // 1. Try to find nearest enemy unit
    let minD = Infinity, best = null;
    gameObjects.forEach((o) => {
      if (o.faction === this.faction || o.remove) return;
      if (o.type === "unit") {
        const d = Math.hypot(o.x - this.x, o.y - this.y);
        if (d < minD) {
          minD = d;
          best = o;
        }
      }
    });
    if (best) {
      this.target = best;
      return;
    }

    // 2. Try to find nearest obelisk not controlled by this faction
    minD = Infinity; best = null;
    gameObjects.forEach((o) => {
      if (o.type === "obelisk" && o.faction !== this.faction && !o.remove) {
        const d = Math.hypot(o.x - this.x, o.y - this.y);
        if (d < minD) {
          minD = d;
          best = o;
        }
      }
    });
    if (best) {
      this.target = best;
      return;
    }

    // 3. Try to find enemy HQ
    minD = Infinity; best = null;
    gameObjects.forEach((o) => {
      if (o.type === "hq" && o.faction !== this.faction && !o.remove) {
        const d = Math.hypot(o.x - this.x, o.y - this.y);
        if (d < minD) {
          minD = d;
          best = o;
        }
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
    // Prevent damage to obelisks
    if (this.type === "obelisk") {
      return; // Obelisks can't take damage
    }
    
    // Handle shield absorption first
    let damageToHealth = amount;
    
    if (this.shield && this.shield > 0) {
      if (this.shield >= damageToHealth) {
        // Shield absorbs all damage
        this.showShieldDamage(damageToHealth);
        this.shield -= damageToHealth;
        return; // No health damage
      } else {
        // Shield absorbs partial damage
        this.showShieldDamage(this.shield);
        damageToHealth -= this.shield;
        this.shield = 0;
      }
    }
    
    // Apply remaining damage to health
    this.health -= damageToHealth;
    this.showDamage(damageToHealth);
    
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
  
  showShieldDamage(amount) {
    const et = document.createElement("div");
    et.className = "effect-text shield-damage";
    et.textContent = `-${amount}`;
    et.style.left = `${this.x + this.w / 2}px`;
    et.style.top = `${this.y}px`;
    et.style.color = this.faction === "player" ? "#60f0ff" : "#ff6060"; // Shield damage color
    document.getElementById("battlefield").appendChild(et);
    setTimeout(() => et.remove(), 1500);
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

export const MechTypes = {
  basic: {
    health: 80,
    maxHealth: 80,
    damage: 15,
    range: 150,
    speed: 60,
    aspd: 0.8,
    renderMethod: function (ctx, mech) {
      // Draw a rectangle for basic units
      ctx.fillRect(mech.x, mech.y, mech.w, mech.h);
    }
  },
  tank: {
    health: 200,
    maxHealth: 200,
    damage: 30,
    range: 120,
    speed: 40,
    aspd: 0.5,
    renderMethod: function (ctx, mech) {
      // Draw a circle for tank units
      ctx.beginPath();
      ctx.arc(mech.x + mech.w / 2, mech.y + mech.h / 2, mech.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  sniper: {
    health: 50,
    maxHealth: 50,
    damage: 40,
    range: 300,
    speed: 50,
    aspd: 1.2,
    renderMethod: function (ctx, mech) {
      // Draw a triangle for sniper units
      ctx.beginPath();
      ctx.moveTo(mech.x + mech.w / 2, mech.y); // Top point
      ctx.lineTo(mech.x, mech.y + mech.h); // Bottom-left point
      ctx.lineTo(mech.x + mech.w, mech.y + mech.h); // Bottom-right point
      ctx.closePath();
      ctx.fill();
    }
  }
};

export class MechFactory {
  static createMech(x, y, type, faction) {
    const mech = new Mech(x, y, type, faction);
    // Apply type-specific properties
    if (MechTypes[type]) {
      Object.assign(mech, MechTypes[type]);
    } else {
      console.warn(`Unknown mech type: ${type}, using basic properties`);
      Object.assign(mech, MechTypes.basic);
    }
    return mech;
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
    const ctx = gameState.get('ctx');
    if (!ctx) return;
    
    // Draw health bar if context is available
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + 82, this.w, 6);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + 82, this.w * pct, 6);

    // Handle unit spawning
    const spawnCooldown = this.faction === "player" ? 
      gameState.get('spawnCooldown') : gameState.get('enemySpawnCooldown');
    if (spawnCooldown <= 0) {
      this.spawnUnit();
    }
  }

  spawnUnit() {
    // Use MechFactory instead of direct Mech instantiation
    const u = MechFactory.createMech(
      this.spawnPoint.x, 
      this.spawnPoint.y,
      "basic",
      this.faction
    );
    gameState.addGameObject(u);

    // Update mech count
    if (this.faction === "player") {
      gameState.set('playerMechs', gameState.get('playerMechs') + 1);
      gameState.set('spawnCooldown', gameState.getConfig('SPAWN_CD'));
    } else {
      gameState.set('enemyMechs', gameState.get('enemyMechs') + 1);
      gameState.set('enemySpawnCooldown', gameState.getConfig('SPAWN_CD'));
    }

    // Visual effect for spawning
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
}

export class Mech extends GameObject {
  constructor(x, y, subtype, f) {
    super(x, y, 40, 40, "unit", f);
    this.subtype = subtype;
    // Properties will be assigned by the factory
  }

  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) {
      console.error("Canvas context is undefined");
      return;
    }

    // Set fill style based on faction
    ctx.fillStyle = this.faction === "player" ? "#4080ff" : "#ff4040";

    // Use the type-specific render method if available
    if (MechTypes[this.subtype] && MechTypes[this.subtype].renderMethod) {
      MechTypes[this.subtype].renderMethod(ctx, this);
    } else {
      // Fallback to basic rendering
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }

    // Draw shield if present
    if (this.shield && this.shield > 0) {
      ctx.strokeStyle = this.faction === "player" ? "#60f0ff" : "#ff6060";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Render health bar
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w, 4);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w * pct, 4);
  }
}

export class Obelisk extends GameObject {
  constructor(x, y) {
    super(x, y, 50, 50, "obelisk", "neutral");
    this.capture = 0; // -1..1
    this.capturedBy = null; // Track which faction owns this obelisk
    this.commandBonus = 2; // How many extra command points this obelisk provides
    this.invulnerable = true; // Flag to ensure obelisks don't get damaged
  }

  update(dt) {
    // Don't use super.update() as we don't want normal targeting behavior
    if (this.cooldown > 0) this.cooldown -= dt;
    
    const prevCapture = this.capture;
    const prevFaction = this.faction;

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
    
    if (Math.abs(this.capture) >= 1) {
      const newFaction = this.capture > 0 ? "player" : "enemy";
      
      // If the obelisk changed ownership
      if (this.faction !== newFaction) {
        // Update faction
        this.faction = newFaction;
        
        // If previously captured by the other faction, remove that bonus first
        if (prevFaction !== "neutral") {
          if (prevFaction === "player") {
            gameState.set('playerObelisks', gameState.get('playerObelisks') - 1);
            console.log("Player lost an obelisk. Command decreased.");
          } else {
            gameState.set('enemyObelisks', gameState.get('enemyObelisks') - 1);
            console.log("Enemy lost an obelisk. Command decreased.");
          }   
        }

        // Add command bonus to new owner
        if (this.faction === "player") {
          gameState.set('playerObelisks', gameState.get('playerObelisks') + 1);
          console.log("Player captured an obelisk! Command increased.");
        } else {
          gameState.set('enemyObelisks', gameState.get('enemyObelisks') + 1);
          console.log("Enemy captured an obelisk! Command increased.");
        }

        // Create capture effect
        this.createCaptureEffect();
      }
    } else {
      // Handle neutral reversion when no units are nearby
      const anyPlayerNearby = gameState.getGameObjects().some(
        (o) => o.faction === "player" && 
               Math.hypot(o.x - this.x, o.y - this.y) < gameState.getConfig('CAPTURE_DIST')
      );
      
      const anyEnemyNearby = gameState.getGameObjects().some(
        (o) => o.faction === "enemy" && 
               Math.hypot(o.x - this.x, o.y - this.y) < gameState.getConfig('CAPTURE_DIST')
      );
      
      // If no units nearby and capture is not at extremes, slowly revert toward neutral
      if (!anyPlayerNearby && !anyEnemyNearby && Math.abs(this.capture) > 0 && Math.abs(this.capture) < 1) {
        // Slowly revert toward neutral state
        if (this.capture > 0) {
          this.capture -= 0.05 * dt;
          if (this.capture < 0) this.capture = 0;
        } else if (this.capture < 0) {
          this.capture += 0.05 * dt;
          if (this.capture > 0) this.capture = 0;
        }
      }
    }
  }

  takeDamage(amount) {
    // Obelisks can't be damaged
    return;
  }

  createCaptureEffect() {
    // Visual effect when obelisk is captured
    const color = this.faction === "player" ? "#60f0ff" : "#ff6060";

    // Add particles shooting outward
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const endX = this.x + this.w/2 + Math.cos(angle) * 100;
      const endY = this.y + this.h/2 + Math.sin(angle) * 100;
      gameState.addParticle(
        new Particle(
          this.x + this.w/2,
          this.y + this.h/2,
          endX,
          endY,
          color,
          0.8
        )
      );
    }
    
    // Add text effect
    const el = document.createElement("div");
    el.className = "effect-text";
    el.textContent = "CAPTURED!";
    el.style.left = `${this.x + this.w / 2}px`;
    el.style.top = `${this.y - 20}px`;
    el.style.color = color;
    el.style.fontSize = "18px";
    document.getElementById("battlefield").appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) {
      console.error("Canvas context is undefined");
      return;
    }

    // Draw base obelisk
    ctx.fillStyle = this.faction === "neutral"
      ? "#888"
      : this.faction === "player"
        ? "#60f0ff"
        : "#ff6060";
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Draw top part to indicate ownership more clearly
    if (this.faction !== "neutral") {
      const glowColor = this.faction === "player" ? "rgba(96, 240, 255, 0.7)" : "rgba(255, 96, 96, 0.7)";
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.w/2, this.y - 15);
      ctx.lineTo(this.x + this.w, this.y);
      ctx.closePath();
      ctx.fill();
    }

    // Progress bar for capture status
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

export class ShieldGenerator extends GameObject {
  constructor(x, y, faction) {
    super(x, y, 60, 60, "structure", faction);
    this.health = this.maxHealth = 150;
    this.range = 250;
    this.shieldStrength = 20; // Amount of shield given to nearby units
    this.pulseTimer = 0;
    this.pulseCooldown = 2; // Shield pulse every 2 seconds
  }

  update(dt) {
    super.update(dt);

    // Shield pulse mechanic
    this.pulseTimer += dt;
    if (this.pulseTimer >= this.pulseCooldown) {
      this.pulseTimer = 0;
      this.shieldPulse();
    }
  }

  shieldPulse() {
    const allies = gameState.getGameObjects().filter(
      obj => obj.faction === this.faction &&
        Math.hypot(obj.x - this.x, obj.y - this.y) <= this.range
    );

    allies.forEach(ally => {
      // Add shield effect or temporary health boost
      if (!ally.shield) ally.shield = 0;
      ally.shield = Math.min(ally.shield + this.shieldStrength, 50);

      // Create visual effect
      gameState.addParticle(new ShieldEffect(
        ally.x + ally.w / 2,
        ally.y + ally.h / 2,
        ally.w * 1.2,
        this.faction === "player" ? "#60f0ff" : "#ff6060"
      ));
    });
  }

  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) return;

    // Draw shield generator base
    ctx.fillStyle = this.faction === "player" ? "#4080ff" : "#ff4040";
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw shield dome
    ctx.strokeStyle = this.faction === "player" ? "#60f0ff" : "#ff6060";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI);
    ctx.stroke();

    // Draw health bar
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w, 4);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w * pct, 4);
  }
}

export class Turret extends Headquarters {
  constructor(x, y, faction) {
    super(x, y, faction);
    this.type = "turret";
    this.w = 50;
    this.h = 50;
    this.health = this.maxHealth = 200;
    this.damage = 25;
    this.range = 250;
    this.aspd = 1.5;
    // Turrets don't spawn units
    this.spawnPoint = null;
  }

  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) return;

    // Draw turret base
    ctx.fillStyle = this.faction === "player" ? "#2040a0" : "#a02020";
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Draw turret gun
    ctx.fillStyle = this.faction === "player" ? "#4080ff" : "#ff4040";
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw barrel pointing at target if available
    if (this.target) {
      const angle = Math.atan2(
        this.target.y + this.target.h / 2 - (this.y + this.h / 2),
        this.target.x + this.target.w / 2 - (this.x + this.w / 2)
      );
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(angle);
      ctx.fillRect(0, -3, this.w / 2, 6);
      ctx.restore();
    } else {
      // Default position if no target
      ctx.fillRect(this.x + this.w / 2, this.y + this.h / 2 - 3, this.w / 2, 6);
    }

    // Draw health bar
    const pct = this.health / this.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w, 4);
    ctx.fillStyle = pct > 0.6 ? "#2f2" : pct > 0.3 ? "#ff2" : "#f22";
    ctx.fillRect(this.x, this.y + this.h + 2, this.w * pct, 4);
  }
}

export class ShieldEffect extends Particle {
  constructor(x, y, size, color) {
    super(x, y, x, y, color);
    this.size = size;
    this.maxSize = size * 1.5;
    this.dur = 0.5;
  }

  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) return;

    const t = this.time / this.dur;
    const currentSize = this.size + (this.maxSize - this.size) * t;

    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x1, this.y1, currentSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export class EMPEffect extends Particle {
  constructor(x, y, radius) {
    super(x, y, x, y, "#fff");
    this.radius = radius;
    this.maxRadius = radius * 3;
    this.dur = 0.8;
  }

  render() {
    const ctx = gameState.get('ctx');
    if (!ctx) return;

    const t = this.time / this.dur;
    const currentRadius = this.radius + (this.maxRadius - this.radius) * t;

    // Create electric effect
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = "#60f0ff";
    ctx.lineWidth = 3;

    // Draw lightning-like circle
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const jitter = Math.random() * 10 - 5;
      const x = this.x1 + Math.cos(angle) * (currentRadius + jitter);
      const y = this.y1 + Math.sin(angle) * (currentRadius + jitter);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}
