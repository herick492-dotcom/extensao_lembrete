// *** CORES ATUALIZADAS AQUI ***
const COR_BADGE_PENDENTE = "#FFA500"; // Laranja/Amarelo para pendente
const COR_BADGE_ALERTA = "#FF0000";   // Vermelho para alerta
const ALARME_PISCA = "PISCAR_BADGE";

// --- Funções do Offscreen Document ---

let creating; // Flag para evitar criar múltiplos documentos offscreen

async function setupOffscreenDocument(path) {
  // Verifica se já existe um documento offscreen ativo
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  // Evita execuções concorrentes enquanto um documento está sendo criado
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Tocar som de alerta do lembrete',
    });
    await creating;
    creating = null;
  }
}


// --- Listeners de Eventos ---

// Ouve por QUALQUER alarme
chrome.alarms.onAlarm.addListener(async (alarm) => {
  
  // --- A. É O ALARME REPETITIVO DE PISCAR? ---
  if (alarm.name === ALARME_PISCA) {
    // Pega as configurações salvas.
    const { configuracoes = { somAtivo: true } } = await chrome.storage.local.get("configuracoes");

    // Toca o som (protegido)
    if (configuracoes.somAtivo) {
      try {
        await setupOffscreenDocument('offscreen.html');
        await chrome.runtime.sendMessage({
          type: 'play-audio',
          target: 'offscreen',
        });
      } catch (e) {
        console.error("Erro ao tocar som repetido (offscreen):", e.message);
      }
    }

  // --- B. É UM ALARME DE TAREFA (ex: "lembrete_123456")? ---
  } else {
    // Um alarme de tarefa foi disparado! Apenas inicia o processo.

    // --- Toca o som (com try/catch) ---
    try {
      const { configuracoes = { somAtivo: true } } = await chrome.storage.local.get("configuracoes");
      if (configuracoes.somAtivo) {
        await setupOffscreenDocument('offscreen.html');
        await chrome.runtime.sendMessage({
          type: 'play-audio',
          target: 'offscreen',
        });
      }
    } catch (e) {
      console.error("Erro ao tentar tocar o som inicial (race condition esperado):", e.message);
    }
    // --- Fim do bloco de som ---

    // 1. Garante a cor de Alerta e estado inicial
    //    *** COR ATUALIZADA PARA ALERTA ***
    await chrome.action.setBadgeBackgroundColor({ color: COR_BADGE_ALERTA });
    await chrome.action.setBadgeText({ text: "!" });

    // 2. Envia mensagem para o content script da aba ativa mostrar o balão
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      // console.log(`[background.js] Enviando mensagem 'showNotification' para a aba ${tab.id}`);
      chrome.tabs.sendMessage(tab.id, { action: 'showNotification' });
    } else {
      console.error("[background.js] Não foi possível encontrar uma aba ativa para enviar a mensagem.");
    }

    // 3. Cria um alarme repetitivo APENAS para o som.
    await chrome.alarms.clear(ALARME_PISCA); 
    await chrome.alarms.create(ALARME_PISCA, {
      delayInMinutes: 0,
      periodInMinutes: 1 / 15 // Toca a cada 4 segundos
    });
  }
});

// Ouve mudanças no storage (ex: ticket adicionado/removido/editado)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.tickets) {
    // Apenas atualiza a contagem se o alarme piscante NÃO estiver ativo.
    chrome.alarms.get(ALARME_PISCA, (alarme) => {
      if (!alarme) {
        const total = changes.tickets.newValue?.length || 0;
        chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
        // *** COR ATUALIZADA PARA PENDENTE ***
        chrome.action.setBadgeBackgroundColor({ color: COR_BADGE_PENDENTE });
      }
    });
  }
});

// Roda quando a extensão é instalada ou atualizada
chrome.runtime.onInstalled.addListener(async () => {
  // Define a contagem inicial no badge.
  const { tickets = [] } = await chrome.storage.local.get("tickets");
  const total = tickets.length;
  await chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
  // *** COR ATUALIZADA PARA PENDENTE ***
  await chrome.action.setBadgeBackgroundColor({ color: COR_BADGE_PENDENTE });
});