const BALLOON_ID = 'lembrete-balloon-notification';

/**
 * Cria e injeta o balão de notificação na página.
 */
function showNotificationBalloon() {
  // Se o balão já existe, não faz nada.
  if (document.getElementById(BALLOON_ID)) {
    return;
  }

  // Cria o container principal do balão
  const balloon = document.createElement('div');
  balloon.id = BALLOON_ID;
  
  // *** ATUALIZADO: Removida a div da seta ***
  balloon.innerHTML = `
    <p>Lembrete de Ticket!</p>
    <span>Clique no ícone da extensão para parar o alarme.</span>
  `;

  // Adiciona os estilos diretamente via JavaScript
  const style = document.createElement('style');
  style.textContent = `
    #${BALLOON_ID} {
      position: fixed;
      top: 10px;
      right: 20px;
      z-index: 999999;
      background-color: #2d3748;
      color: white;
      padding: 15px 20px;
      border-radius: 12px; /* <-- Aumentado para ficar mais redondo */
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      font-family: 'Roboto', sans-serif;
      animation: slide-in 0.5s forwards;
    }
    #${BALLOON_ID} p { margin: 0; font-size: 1.1em; font-weight: 500; }
    #${BALLOON_ID} span { margin-top: 4px; font-size: 0.9em; opacity: 0.8; }
    
    /* *** REGRA DA SETA REMOVIDA DAQUI *** */

    @keyframes slide-in {
      from { transform: translateY(-50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(balloon);
}

/**
 * Remove o balão de notificação da página.
 */
function hideNotificationBalloon() {
  const balloon = document.getElementById(BALLOON_ID);
  if (balloon) {
    balloon.remove();
  }
}

// Ouve por mensagens vindas do background ou do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showNotification') {
    showNotificationBalloon();
  } else if (request.action === 'hideNotification') {
    hideNotificationBalloon();
  }
});