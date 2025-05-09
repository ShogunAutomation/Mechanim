// Hand UI logic
export function renderHand(handEl, playerHand, allCards, playCard, gameState) {
  handEl.innerHTML = "";
  playerHand.forEach((cardIdx, i) => {
    const c = allCards[cardIdx];
    const d = document.createElement("div");
    d.className = "card";
    d.dataset.handIdx = i;
    const atCommandLimit = c.type === "unit" && gameState.get('playerMechs') >= gameState.getMaxCommand("player");
    if (atCommandLimit) {
      d.classList.add("command-limited");
    }
    d.innerHTML = `
      <span class="card-cost">${c.cost}</span>
      <span class="card-title">${c.name}</span>
    `;
    d.onmousedown = function() {
      if (gameState.get('gameRunning')) {
        playCard(i);
      }
    };
    handEl.appendChild(d);
  });
}
