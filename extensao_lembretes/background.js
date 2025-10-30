let isBlinking = false; // Controla o estado do "pisca-pisca"

// MUDANÇA AQUI: A cor padrão agora é vermelha.
const COR_PADRAO = "#FF0000"; // Vermelho (para contagem)
const COR_ALERTA = "#FF0000"; // Vermelho (para piscar)

/**
 * Função principal para atualizar o badge com a CONTAGEM de tickets.
 */
async function atualizarBadgeCount() {
  const { tickets = [] } = await chrome.storage.local.get("tickets");
  const total = tickets.length;
  
  await chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: COR_PADRAO });
}

// --- Listeners de Eventos ---

// Ouve por QUALQUER alarme
chrome.alarms.onAlarm.addListener(async (alarm) => {
  
  // --- A. É O ALARME REPETITIVO DE PISCAR? ---
  if (alarm.name === "PISCAR_BADGE") {
    
    // Alterna o texto do badge ("!" -> "" -> "!" -> "")
    if (isBlinking) {
      await chrome.action.setBadgeText({ text: "!" });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
    isBlinking = !isBlinking; // Inverte o estado

  // --- B. É UM ALARME DE TAREFA (ex: "lembrete_123456")? ---
  } else {
    // Um alarme de tarefa foi disparado!
    
    // 1. Garante a cor de Alerta (Vermelho)
    await chrome.action.setBadgeBackgroundColor({ color: COR_ALERTA });
    
    // 2. Inicia o alarme PISCANTE
    await chrome.alarms.create("PISCAR_BADGE", {
      periodInMinutes: 1 / 60, // 1 segundo
    });
    
    // 3. Define o estado de pisca
    isBlinking = true;
  }
});

// Ouve mudanças no storage (ex: ticket adicionado/removido/editado)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.tickets) {
    // Se não estiver piscando, atualiza a contagem
    if (!isBlinking) {
      atualizarBadgeCount();
    }
  }
});

// Roda quando a extensão é instalada ou atualizada
chrome.runtime.onInstalled.addListener(() => {
  // Define a contagem inicial ao instalar
  atualizarBadgeCount();
});