
    // ==== constants & state ====
    const ENERGY_MAX = 10, ENERGY_RATE = 1, CMD_BASE = 5;
    const CARD_DRAW_INTERVAL = 4, MAX_HAND = 5;
    const SPAWN_CD = 3, CAPTURE_DIST = 80, CAPTURE_RATE = 0.2;
    let canvas, ctx, w, h, lastTS = 0;
    let gameRunning = false;

    let pe = 0, pm = 0, ee = 0, em = 0;
    let drawTimer = 0, scd = 0, escd = 0;

    let gameObjects = [], particles = [];
    let allCards = [], playerDeck = [], playerHand = [], aiHand = [];

    // UI elements
    const eMenu = document.getElementById('menu-screen');
    const eEnd = document.getElementById('end-screen');
    const eDeckB = document.getElementById('deck-builder');
    const eTutorial = document.getElementById('tutorial-modal');

    // ==== setup ====
    window.onload = () => {
      canvas = document.getElementById('game-canvas');
      ctx = canvas.getContext('2d');
      resize(); window.onresize = resize;

      setupUI();
      initCards();
      loadDeck();

      if (!localStorage.tutorialShown) {
        showTutorial();
        localStorage.tutorialShown = '1';
      }
    };

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      w = rect.width;
      h = rect.height;
    }

    function setupUI() {
      document.getElementById('start-button').onclick = startGame;
      document.getElementById('deck-builder-button').onclick = openDeckBuilder;
      document.getElementById('restart-button').onclick = restartGame;
      document.getElementById('back-button').onclick = closeDeckBuilder;
      document.getElementById('save-deck-button').onclick = saveDeck;
      document.getElementById('tutorial-close').onclick = closeTutorial;
      document.getElementById('card-hand').onclick = handleCardClick;
    }

    function showTutorial() {
      eTutorial.style.display = 'flex';
    }
    function closeTutorial() {
      eTutorial.style.display = 'none';
    }

    function openDeckBuilder() {
      eMenu.style.display = 'none';
      eDeckB.style.display = 'flex';
    }
    function closeDeckBuilder() {
      eDeckB.style.display = 'none';
      eMenu.style.display = 'flex';
    }

    // ==== Card System ====
    function initCards() {
      allCards = [
        { name: 'Basic Mech', type: 'unit', cost: 2, unit: 'basic', desc: 'Spawn a basic mech.' },
        { name: 'Tank Mech', type: 'unit', cost: 4, unit: 'tank', desc: 'Spawn a heavy tank.' },
        { name: 'Heal Spell', type: 'spell', cost: 3, effect: target => {
            target.health = Math.min(target.health + 30, target.maxHealth);
          }, desc: 'Heal 30 HP to nearest unit.' },
        { name: 'Turret', type: 'structure', cost: 5, desc: 'Place a turret spawn point.' }
      ];

      const collection = document.getElementById('card-collection');
      allCards.forEach((card, idx) => {
        const el = document.createElement('div');
        el.className = 'collection-card';
        el.innerHTML = `
          <div style="position:absolute;top:5px;left:5px;color:#60f0ff;font-weight:bold;">${card.cost}</div>
          <div style="position:absolute;bottom:5px;width:100%;text-align:center;font-size:8px;">${card.name}</div>
        `;
        el.onclick = () => toggleDeck(idx, el);
        collection.appendChild(el);
      });
    }

    function toggleDeck(idx, el) {
      const pos = playerDeck.indexOf(idx);
      if (pos >= 0) {
        playerDeck.splice(pos, 1);
        el.classList.remove('selected');
      } else if (playerDeck.length < 20) {
        playerDeck.push(idx);
        el.classList.add('selected');
      }
      document.getElementById('deck-card-count').textContent = playerDeck.length;
    }

    function saveDeck() {
      localStorage.playerDeck = JSON.stringify(playerDeck);
      closeDeckBuilder();
    }

    function loadDeck() {
      if (localStorage.playerDeck) {
        playerDeck = JSON.parse(localStorage.playerDeck);
        document.querySelectorAll('.collection-card').forEach((el, idx) => {
          if (playerDeck.includes(idx)) el.classList.add('selected');
        });
      } else {
        // default deck
        playerDeck = [0,0,1,1,2,2,3];
      }
      document.getElementById('deck-card-count').textContent = playerDeck.length;
    }

    // ==== Game Objects & Logic ====
    class GameObject {
      constructor(x, y, w, h, type, faction) {
        Object.assign(this, { x, y, w, h, type, faction, health:100, maxHealth:100, damage:10, range:100, cooldown:0, aspd:1, speed:0, target:null, remove:false });
      }
      update(dt) {
        if (this.cooldown > 0) this.cooldown -= dt;
        if (!this.target || this.target.remove) this.acquireTarget();
        if (this.target) {
          const dx = this.target.x - this.x, dy = this.target.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= this.range) {
            if (this.cooldown <= 0) {
              this.target.takeDamage(this.damage);
              this.cooldown = 1 / this.aspd;
              this.spawnEffect(this.target);
            }
          } else if (this.speed > 0) {
            this.x += dx/dist * this.speed * dt;
            this.y += dy/dist * this.speed * dt;
          }
        }
      }
      acquireTarget() {
        let minD = Infinity, best = null;
        gameObjects.forEach(o => {
          if (o.faction === this.faction || o.remove) return;
          let d = Math.hypot(o.x - this.x, o.y - this.y);
          if (o.type === 'hq') d *= 0.5;
          if (d < minD) { minD = d; best = o; }
        });
        this.target = best;
      }
      spawnEffect(tgt) {
        particles.push(new Particle(this.x + this.w/2, this.y + this.h/2, tgt.x + tgt.w/2, tgt.y + tgt.h/2, this.faction==='player'? '#60f0ff':'#ff6060'));
      }
      takeDamage(amount) {
        this.health -= amount;
        this.showDamage(amount);
        if (this.health <= 0) {
          this.remove = true;
          if (this.type !== 'hq' && this.type !== 'obelisk') {
            if (this.faction === 'player') pm--; else em--;
          }
          if (this.type === 'hq') endGame(this.faction !== 'player');
        }
      }
      showDamage(amount) {
        const et = document.createElement('div');
        et.className = 'effect-text';
        et.textContent = `-${amount}`;
        et.style.left  = `${this.x + this.w/2}px`;
        et.style.top   = `${this.y}px`;
        document.getElementById('battlefield').appendChild(et);
        setTimeout(()=>et.remove(), 1500);
      }
      render() {
        // body
        ctx.fillStyle = this.faction==='player'? '#4080ff':'#ff4040';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        // health bar
        const pct = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y+this.h+2, this.w, 4);
        ctx.fillStyle = pct>0.6? '#2f2': pct>0.3? '#ff2':'#f22';
        ctx.fillRect(this.x, this.y+this.h+2, this.w*pct, 4);
      }
    }

    class Headquarters extends GameObject {
      constructor(x,y,f) {
        super(x,y,80,80,'hq',f);
        this.health = this.maxHealth = 500;
        this.range = 200; this.damage = 15; this.aspd = 0.5;
        this.spawnPoint = { x: x + (f==='player'?100:-60), y: y+40 };
      }
      update(dt) {
        super.update(dt);
        if (this.faction==='player' && scd<=0) { this.spawnUnit(); scd = SPAWN_CD; }
        if (this.faction==='enemy'  && escd<=0) { this.spawnUnit(); escd = SPAWN_CD; }
      }
      spawnUnit() {
        const u = new Mech(this.spawnPoint.x, this.spawnPoint.y, 'basic', this.faction);
        gameObjects.push(u);
        if (this.faction==='player') pm++; else em++;
        particles.push(new Particle(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.x, this.spawnPoint.y, this.faction==='player'? '#60f0ff':'#ff6060', 0.4));
      }
      render() {
        // gradient body
        const grad = ctx.createRadialGradient(this.x+40,this.y+40,10,this.x+40,this.y+40,50);
        grad.addColorStop(0, this.faction==='player'? '#80c0ff':'#ff8080');
        grad.addColorStop(1, this.faction==='player'? '#2040a0':'#a02020');
        ctx.fillStyle = grad;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        // border
        ctx.strokeStyle = this.faction==='player'? '#60f0ff':'#ff6060';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        // health bar
        const pct = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y+82, this.w, 6);
        ctx.fillStyle = pct>0.6? '#2f2': pct>0.3? '#ff2':'#f22';
        ctx.fillRect(this.x, this.y+82, this.w*pct, 6);
      }
    }

    class Mech extends GameObject {
      constructor(x,y,subtype,f) {
        super(x,y,40,40,'unit',f);
        this.subtype = subtype;
        switch(subtype) {
          case 'basic':  this.health=80;  this.maxHealth=80;  this.damage=15; this.range=150; this.speed=60; this.aspd=0.8; break;
          case 'tank':   this.health=200; this.maxHealth=200; this.damage=30; this.range=120; this.speed=40; this.aspd=0.5; break;
        }
      }
      render() {
        ctx.fillStyle = this.faction==='player'? '#4080ff':'#ff4040';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        const pct = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y+42, this.w, 4);
        ctx.fillStyle = pct>0.6? '#2f2': pct>0.3? '#ff2':'#f22';
        ctx.fillRect(this.x, this.y+42, this.w*pct, 4);
      }
    }

    class Obelisk extends GameObject {
      constructor(x,y) {
        super(x,y,50,50,'obelisk','neutral');
        this.capture = 0; // -1..1
      }
      update(dt) {
        super.update(dt);
        ['player','enemy'].forEach(f => {
          const inRange = gameObjects.some(o => o.faction===f && Math.hypot(o.x-this.x,o.y-this.y)<CAPTURE_DIST);
          if (inRange) {
            this.capture += (f==='player'?CAPTURE_RATE:-CAPTURE_RATE)*dt;
            this.capture = Math.max(-1, Math.min(1, this.capture));
          }
        });
        if (Math.abs(this.capture)>=1 && this.faction==='neutral') {
          this.faction = this.capture>0?'player':'enemy';
          if (this.faction==='player') pm++;
          else em++;
        }
      }
      render() {
        ctx.fillStyle = this.faction==='neutral'? '#888' : (this.faction==='player'? '#60f0ff':'#ff6060');
        ctx.fillRect(this.x, this.y, this.w, this.h);
        // progress bar
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y+52, this.w, 4);
        const wProg = (this.capture+1)/2 * this.w;
        ctx.fillStyle = this.capture>0?'#2f2':'#f22';
        ctx.fillRect(this.x, this.y+52, wProg, 4);
      }
    }

    class Particle {
      constructor(x1,y1,x2,y2,color,dur=0.2) {
        Object.assign(this,{x1,y1,x2,y2,color,time:0,dur});
      }
      update(dt) {
        this.time += dt;
        return this.time < this.dur;
      }
      render() {
        const t = this.time/this.dur;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x1 + (this.x2-this.x1)*t, this.y1 + (this.y2-this.y1)*t);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ==== Game Loop & Flow ====
    function startGame() {
      eMenu.style.display = 'none';
      resetGame();
      gameRunning = true;
      lastTS = 0;
      requestAnimationFrame(tick);
    }

    function resetGame() {
      gameObjects = [];
      particles = [];
      pe = ENERGY_MAX; ee = ENERGY_MAX; pm = 0; em = 0;
      drawTimer = scd = escd = 0;

      // spawn HQs
      gameObjects.push(new Headquarters(100, h/2-40, 'player'));
      gameObjects.push(new Headquarters(w-180, h/2-40, 'enemy'));

      // spawn obelisks
      [[w/2-50, h/3], [w/3, h/2+100], [2*w/3, h/2+100]]
        .forEach(([x,y]) => gameObjects.push(new Obelisk(x,y)));

      // initial hands
      playerHand = [];
      aiHand     = [];
      for (let i=0; i<3; i++) {
        drawCard('player');
        drawCard('enemy');
      }
    }

    function restartGame() {
      eEnd.style.display = 'none';
      startGame();
    }

    function tick(ts) {
      if (!gameRunning) return;
      const dt = lastTS ? (ts - lastTS)/1000 : 0;
      lastTS = ts;

      update(dt);
      render();

      requestAnimationFrame(tick);
    }

    function update(dt) {
      // regen energy
      pe = Math.min(ENERGY_MAX, pe + ENERGY_RATE * dt);
      ee = Math.min(ENERGY_MAX, ee + ENERGY_RATE * dt);

      // spawn cooldowns
      if (scd > 0) scd -= dt;
      if (escd > 0) escd -= dt;

      // card draw timing
      drawTimer += dt;
      if (drawTimer >= CARD_DRAW_INTERVAL) {
        drawCard('player');
        drawCard('enemy');
        drawTimer = 0;
        aiPlay();
      }

      // update game objects
      gameObjects.forEach(o => o.update(dt));
      gameObjects = gameObjects.filter(o => !o.remove);

      // update particles
      particles = particles.filter(p => {
        const alive = p.update(dt);
        if (alive) p.render();
        return alive;
      });

      updateUI();
    }

    function render() {
      ctx.clearRect(0,0,w,h);
      gameObjects.forEach(o => o.render());
      // particles are rendered during update for smooth timing
    }

    function updateUI() {
      document.getElementById('energy-value').textContent  = `${Math.floor(pe)}/${ENERGY_MAX}`;
      document.getElementById('command-value').textContent = `${pm}/${CMD_BASE}`;
      document.getElementById('deck-count').textContent     = `${playerDeck.length}`;

      // render hand
      const handEl = document.getElementById('card-hand');
      handEl.innerHTML = '';
      playerHand.forEach((cardIdx, i) => {
        const c = allCards[cardIdx];
        const d = document.createElement('div');
        d.className = 'card';
        d.dataset.handIdx = i;
        d.innerHTML = `
          <div class="card-cost">${c.cost}</div>
          <div class="card-image"></div>
          <div class="card-title">${c.name}</div>
          <div class="card-desc">${c.desc}</div>
        `;
        handEl.appendChild(d);
      });
    }

    function drawCard(who) {
      if (who === 'player' && playerHand.length < MAX_HAND) {
        playerHand.push(playerDeck[Math.floor(Math.random()*playerDeck.length)]);
      }
      if (who === 'enemy' && aiHand.length < MAX_HAND) {
        aiHand.push(playerDeck[Math.floor(Math.random()*playerDeck.length)]);
      }
    }

    function handleCardClick(evt) {
      if (!gameRunning) return;
      const cardEl = evt.target.closest('.card');
      if (!cardEl) return;
      const idx = parseInt(cardEl.dataset.handIdx);
      playCard(idx);
    }

    function playCard(handIdx) {
      const idx = playerHand[handIdx];
      const card = allCards[idx];
      if (pe < card.cost) return;
      pe -= card.cost;
      playerHand.splice(handIdx, 1);

      if (card.type === 'unit') {
        const m = new Mech(150, h-200, card.unit, 'player');
        gameObjects.push(m);
        pm++;
      } else if (card.type === 'spell') {
        // find nearest friendly
        const friendlies = gameObjects.filter(o => o.faction==='player' && o.type!=='hq');
        if (friendlies.length>0) {
          friendlies.sort((a,b) => a.health - b.health);
          card.effect(friendlies[0]);
        }
      } else if (card.type === 'structure') {
        // place a turret spawn point
        gameObjects.push(new Headquarters(w/2-40, h-100, 'player'));
      }
    }

    function aiPlay() {
      for (let i=0; i<aiHand.length; i++) {
        const idx = aiHand[i], c = allCards[idx];
        if (ee >= c.cost) {
          ee -= c.cost;
          aiHand.splice(i,1);
          if (c.type === 'unit') {
            const m = new Mech(w-150,200,c.unit,'enemy');
            gameObjects.push(m);
            em++;
          }
          break;
        }
      }
    }

    function endGame(playerLost) {
      gameRunning = false;
      document.getElementById('end-message').textContent = playerLost? 'DEFEAT':'VICTORY';
      eEnd.style.display = 'flex';
    }
  
