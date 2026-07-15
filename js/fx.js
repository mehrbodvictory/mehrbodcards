/**
 * Visual Effects Manager for Mehrbod Cards
 * Call these functions inside your game logic (game.js or ui.js)
 */
const FX = {
  
  /**
   * Triggers a physical bump attack animation on a card element.
   * Usage: FX.attack(document.getElementById('card-123'));
   */
  attack(cardElement) {
    if (!cardElement) return;
    cardElement.classList.add('fx-attack');
    // Remove the class after animation completes so it can be triggered again
    setTimeout(() => {
      cardElement.classList.remove('fx-attack');
    }, 400); 
  },

  /**
   * Triggers an exploding death animation and then hides the element.
   * Usage: FX.explode(document.getElementById('card-123'), () => { /* remove from DOM */ });
   */
  explode(cardElement, callback) {
    if (!cardElement) return;
    cardElement.classList.add('fx-explode');
    
    setTimeout(() => {
      cardElement.classList.remove('fx-explode');
      if (callback) callback(); // Safely remove it from DOM here
    }, 500);
  },

  /**
   * Triggers a global screen flash for heavy spells (like Lightning).
   * Usage: FX.lightning();
   */
  lightning() {
    const flash = document.createElement('div');
    flash.className = 'fx-lightning-flash';
    document.body.appendChild(flash);
    
    setTimeout(() => {
      flash.remove();
    }, 400);
  },

  /**
   * Triggers a glowing pulse when a chip is successfully dragged onto a spell.
   * Usage: FX.applyChip(spellCardElement);
   */
  applyChip(spellElement) {
    if (!spellElement) return;
    spellElement.classList.add('fx-chip-apply');
    
    setTimeout(() => {
      spellElement.classList.remove('fx-chip-apply');
    }, 600);
  },
  
  /**
   * Toggles the Ready button state visually (Red to Green).
   * Usage: FX.toggleReady(readyBtnElement, true);
   */
  toggleReady(btnElement, isReady) {
    if (!btnElement) return;
    if (isReady) {
      btnElement.classList.add('is-ready');
      btnElement.innerText = "Ready!";
    } else {
      btnElement.classList.remove('is-ready');
      btnElement.innerText = "Not Ready";
    }
  }
};

window.FX = FX;