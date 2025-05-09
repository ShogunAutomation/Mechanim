import * as gameState from './gameState.js';
import { Mech, Turret, EMPEffect, ShieldGenerator, Particle } from './gameObjects.js';

// Card definitions and state
let allCards = [];
let playerDeck = [];
let playerHand = [];
let aiHand = [];

// Export card state
export { allCards, playerDeck, playerHand, aiHand };

export function initCards() {
  allCards = [
    {
      name: "Basic Mech",
      type: "unit",
      cost: 2,
      unit: "basic",
      desc: "Spawn a basic mech with balanced stats.",
      icon: "🤖",
      play: () => {
        const h = gameState.get('height');
        const mech = new Mech(150, h - 200, "basic", "player");
        gameState.addGameObject(mech);
        gameState.set('playerMechs', gameState.get('playerMechs') + 1);
      }
    },
    {
      name: "Tank Mech",
      type: "unit",
      cost: 4,
      unit: "tank",
      desc: "Spawn a heavy tank with high health and damage.",
      icon: "🛡️",
      play: () => {
        const h = gameState.get('height');
        const mech = new Mech(150, h - 200, "tank", "player");
        gameState.addGameObject(mech);
        gameState.set('playerMechs', gameState.get('playerMechs') + 1);
      }
    },
    {
      name: "Heal Spell",
      type: "spell",
      cost: 3,
      desc: "Heal 30 HP to nearest friendly unit.",
      icon: "✨",
      play: () => {
        const friendlies = gameState.getGameObjects().filter(
          (o) => o.faction === "player" && o.type !== "hq"
        );
        if (friendlies.length > 0) {
          friendlies.sort((a, b) => a.health - b.health);
          const target = friendlies[0];
          target.health = Math.min(target.health + 30, target.maxHealth);
          
          // Add healing visual effect
          const healEffect = new Particle(
            target.x + target.w/2, 
            target.y + target.h/2,
            target.x + target.w/2, 
            target.y - 20,
            "#2f2",
            1.0
          );
          gameState.addParticle(healEffect);
          
          console.log(`Heal applied to: ${target.type} (Health: ${target.health})`);
        }
      }
    },
    {
      name: "Turret",
      type: "structure",
      cost: 5,
      desc: "Place a turret spawn point to defend your base.",
      icon: "🔫",
      play: () => {
        const h = gameState.get('height');
        const w = gameState.get('width');
        gameState.addGameObject(new Turret(w / 2 - 25, h - 100, "player"));
      }
    },
    {
      name: "Sniper Mech",
      type: "unit",
      cost: 3,
      unit: "sniper",
      desc: "Spawn a sniper mech with high damage but low health.",
      icon: "🎯",
      play: () => {
        const h = gameState.get('height');
        const mech = new Mech(150, h - 200, "sniper", "player");
        gameState.addGameObject(mech);
        gameState.set('playerMechs', gameState.get('playerMechs') + 1);
      }
    },
    {
      name: "Shield Generator",
      type: "structure",
      cost: 6,
      desc: "Place a shield generator to protect nearby units.",
      icon: "🛡️",
      play: () => {
        const h = gameState.get('height');
        const w = gameState.get('width');
        gameState.addGameObject(new ShieldGenerator(w / 2 - 30, h - 100, "player"));
      }
    },
    {
      name: "EMP Blast",
      type: "spell",
      cost: 4,
      desc: "Stun all enemy units in a small radius.",
      icon: "⚡",
      play: () => {
        const w = gameState.get('width');
        const h = gameState.get('height');
        const empCenter = { x: w / 2, y: h / 2 };
        const empRadius = 150;
        
        // Add EMP visual effect
        gameState.addParticle(new EMPEffect(empCenter.x, empCenter.y, empRadius));
        
        // Apply stun to enemies in range
        const enemies = gameState.getGameObjects().filter(
          (o) => o.faction === "enemy" && 
                 Math.hypot(o.x + o.w/2 - empCenter.x, o.y + o.h/2 - empCenter.y) <= empRadius
        );
        
        enemies.forEach(enemy => {
          enemy.stunned = true;
          enemy.stunnedTime = 3; // Stun for 3 seconds
          
          // Add a visual indicator for stunned units
          const el = document.createElement("div");
          el.textContent = "⚡";
          el.style.position = "absolute";
          el.style.left = `${enemy.x + enemy.w/2}px`;
          el.style.top = `${enemy.y - 20}px`;
          el.style.color = "#ffff00";
          el.style.fontSize = "20px";
          el.style.zIndex = "10";
          el.style.pointerEvents = "none";
          el.style.animation = "float-up 3s forwards";
          document.getElementById("battlefield").appendChild(el);
          setTimeout(() => el.remove(), 3000);
        });
        
        console.log(`EMP Blast applied to ${enemies.length} enemies.`);
      }
    }
  ];

  const collection = document.getElementById("card-collection");
  collection.innerHTML = ''; // Clear existing cards

  renderCardCollection(allCards);
}

function renderCardCollection(cards) {
  const collection = document.getElementById("card-collection");
  const cardContainer = document.createElement("div");
  cardContainer.id = "card-container";
  cardContainer.className = "scrollable-area"; // Add scrollable class
  cardContainer.innerHTML = ''; // Clear existing cards

  cards.forEach((card, idx) => {
    const el = document.createElement("div");
    el.className = "collection-card";
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-type">${card.type}</div>
      <div class="card-icon">${card.icon || ''}</div>
      <div class="card-title">${card.name}</div>
      <div class="card-desc">${card.desc}</div>
    `;
    el.onclick = () => toggleDeck(idx, el);
    cardContainer.appendChild(el);
  });

  collection.appendChild(cardContainer);
}

export function toggleDeck(idx, el) {
  if (playerDeck.length < 20) {
    playerDeck.push(idx); // Allow duplicates by simply adding the index
    el.classList.add("selected");
  }
  document.getElementById("deck-card-count").textContent = playerDeck.length;
  updateCurrentDeckDisplay();
}

export function saveDeck() {
  if (playerDeck.length === 0) {
    alert("Your deck is empty! Please add some cards before saving.");
    return;
  }

  localStorage.playerDeck = JSON.stringify(playerDeck);
  // Use window.closeDeckBuilder since we can't import circular dependencies
  window.closeDeckBuilder();
}

export function loadDeck() {
  if (localStorage.playerDeck) {
    playerDeck = JSON.parse(localStorage.playerDeck);
    document.querySelectorAll(".collection-card").forEach((el, idx) => {
      if (playerDeck.includes(idx)) el.classList.add("selected");
    });
  } else {
    // default deck
    playerDeck = [0, 0, 1, 1, 2, 2, 3];
  }
  document.getElementById("deck-card-count").textContent = playerDeck.length;
  updateCurrentDeckDisplay();
}

export function updateCurrentDeckDisplay() {
  const currentDeckEl = document.getElementById("current-deck");
  if (!currentDeckEl) return;
  
  currentDeckEl.innerHTML = '';

  // Create a count of each card in the deck
  const cardCounts = {};
  playerDeck.forEach(idx => {
    cardCounts[idx] = (cardCounts[idx] || 0) + 1;
  });

  // Display each unique card with count
  Object.keys(cardCounts).forEach(idx => {
    const card = allCards[idx];
    const count = cardCounts[idx];

    const el = document.createElement("div");
    el.className = "collection-card";
    el.dataset.cardIdx = idx;
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-type">${card.type}</div>
      <div class="card-icon">${card.icon || ''}</div>
      <div class="card-title">${card.name} x${count}</div>
      <div class="card-desc">${card.desc}</div>
    `;
    currentDeckEl.appendChild(el);
  });

  // If deck is empty, show a message
  if (playerDeck.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.style.width = "100%";
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.padding = "40px 0";
    emptyMsg.style.color = "#aaa";
    emptyMsg.textContent = "Your deck is empty. Click cards from the collection to add them.";
    currentDeckEl.appendChild(emptyMsg);
  }
}

export function drawCard(who) {
  if (who === "player" && playerHand.length < 5) {
    playerHand.push(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
  }
  if (who === "enemy" && aiHand.length < 5) {
    aiHand.push(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
  }
}

export function playCard(handIdx) {
  const idx = playerHand[handIdx];
  const card = allCards[idx];
  
  const playerEnergy = gameState.get('playerEnergy');
  if (playerEnergy < card.cost) {
    console.log(`Not enough energy to play card: ${card.name} (Cost: ${card.cost}, Energy: ${playerEnergy})`);
    return;
  }

  // Deduct energy and remove the card from the hand
  gameState.set('playerEnergy', playerEnergy - card.cost);
  playerHand.splice(handIdx, 1);

  // Execute the card's play behavior
  console.log(`Playing card: ${card.name}`);
  card.play();
}
