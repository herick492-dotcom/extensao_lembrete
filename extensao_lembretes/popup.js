// --- Elementos do DOM ---
const salvarBtn = document.getElementById("salvar");
const cancelarBtn = document.getElementById("cancelar"); // Novo
const salvar1hBtn = document.getElementById("salvar-1h"); // Novo botão
const linkInput = document.getElementById("link");
const ticketInput = document.getElementById("ticket");
const horarioInput = document.getElementById("horario");
const listaUl = document.getElementById("lista-tickets");
const somAlertaToggle = document.getElementById("som-alerta-toggle");

// --- Variáveis de Estado ---
let editingId = null; // Controla se estamos em modo de edição
const COR_BADGE_PENDENTE = "#FFA500"; // Laranja/Amarelo
const ALARME_PISCA = "PISCAR_BADGE"; // Nome do alarme piscante

// --- Funções Auxiliares ---

/**
 * Converte um timestamp (milisegundos) para o formato HH:MM
 * exigido pelo input 'time'.
 */
function timestampToTimeInput(timestamp) {
  const date = new Date(timestamp);
  const pad = (num) => String(num).padStart(2, '0');
  
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  
  return `${h}:${m}`;
}

/**
 * Reseta o formulário para o estado inicial (novo lembrete).
 */
function resetForm() {
  linkInput.value = "";
  ticketInput.value = "";
  horarioInput.value = "";
  
  salvarBtn.textContent = "Salvar Lembrete";
  cancelarBtn.style.display = "none";
  editingId = null;
}

// --- Funções Principais ---

/**
 * Para o alarme piscante e restaura a contagem no badge.
 */
async function pararAlarmeERestaurarBadge() {
  // Para o alarme piscante
  await chrome.alarms.clear(ALARME_PISCA);

  // Restaura a contagem no badge
  const { tickets = [] } = await chrome.storage.local.get("tickets");
  const total = tickets.length;

  await chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: COR_BADGE_PENDENTE });

  // Envia mensagem para o content script da aba ativa esconder o balão
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'hideNotification' });
  }
}

/**
 * Carrega e exibe todos os lembretes pendentes na lista.
 */
async function carregarTickets() {
  const { tickets = [] } = await chrome.storage.local.get("tickets");
  listaUl.innerHTML = ""; 

  if (tickets.length === 0) {
    listaUl.innerHTML = "<li>Nenhum lembrete pendente.</li>";
  } else {
    const ticketsOrdenados = tickets.sort((a, b) => b.horario - a.horario);

    for (const item of ticketsOrdenados) {
      const li = document.createElement("li");
      
      // Conteúdo (Link, Descrição, Horário)
      const contentDiv = document.createElement("div");
      contentDiv.className = "item-content";
      
      const linkElement = document.createElement("a");
      linkElement.href = item.link;
      linkElement.target = "_blank";
      linkElement.textContent = item.link;
      linkElement.title = "Abrir link";
      
      const descElement = document.createElement("div");
      descElement.textContent = item.ticket;
      
      const horarioElement = document.createElement("span");
      const dataFormatada = new Date(item.horario).toLocaleString("pt-BR", {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      horarioElement.textContent = `Lembrete: ${dataFormatada}`;

      contentDiv.appendChild(linkElement);
      contentDiv.appendChild(descElement);
      contentDiv.appendChild(horarioElement);
      li.appendChild(contentDiv);

      // Container para os botões de ação
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "item-actions";

      // --- NOVO: Botão de Editar ---
      const editBtn = document.createElement("button");
      editBtn.className = "edit-btn";
      editBtn.textContent = "✏️";
      editBtn.title = "Editar Lembrete";
      editBtn.onclick = () => {
        // Entra no modo de edição
        editingId = item.id;
        linkInput.value = item.link;
        ticketInput.value = item.ticket;
        // *** FUNÇÃO ATUALIZADA AQUI ***
        horarioInput.value = timestampToTimeInput(item.horario); // Usa a função auxiliar
        
        salvarBtn.textContent = "Atualizar Lembrete";
        cancelarBtn.style.display = "block";
        window.scrollTo(0, 0); // Rola para o topo do popup
      };
      
      // Botão de Concluir (Remover)
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "✅";
      deleteBtn.title = "Concluir/Remover Lembrete";
      deleteBtn.onclick = async () => {
        const { tickets: ticketsAtuais = [] } = await chrome.storage.local.get("tickets");
        const novosTickets = ticketsAtuais.filter(t => t.id !== item.id);
        await chrome.storage.local.set({ tickets: novosTickets });
        
        await chrome.alarms.clear(item.id);
        
        // Se o item deletado era o que estava sendo editado, reseta o form
        if (editingId === item.id) {
          resetForm();
        }
        
        carregarTickets(); // Recarrega a lista
      };

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      li.appendChild(actionsDiv);
      
      listaUl.appendChild(li);
    }
  }

  // Garante que o badge seja atualizado sempre que a lista for carregada
}

/**
 * Função reutilizável para criar um novo lembrete e alarme.
 */
async function criarNovoLembrete(link, ticket, dataAlarme) {
  const { tickets = [] } = await chrome.storage.local.get("tickets");
  const id = `lembrete_${Date.now()}`;
  
  tickets.push({ id, link, ticket, horario: dataAlarme });
  await chrome.alarms.create(id, { when: dataAlarme });
  
  await chrome.storage.local.set({ tickets });
  
  resetForm();
  carregarTickets();
}

// --- Event Listeners do Formulário ---

/**
 * Evento de clique do botão "Salvar Lembrete" ou "Atualizar Lembrete"
 */
salvarBtn.onclick = async () => {
  const link = linkInput.value;
  const ticket = ticketInput.value;
  const horario = horarioInput.value; // Agora retorna "HH:MM"

  if (!link || !ticket || !horario) {
    alert("Por favor, preencha todos os campos.");
    return; 
  }

  // *** LÓGICA DE DATA/HORA ATUALIZADA ***
  // 1. Pega a hora e minuto do input
  const [horas, minutos] = horario.split(':');
  
  // 2. Cria um objeto Date com a data de HOJE
  const dataAlarme = new Date();
  
  // 3. Define a hora e minuto do alarme
  dataAlarme.setHours(horas);
  dataAlarme.setMinutes(minutos);
  dataAlarme.setSeconds(0);
  dataAlarme.setMilliseconds(0);

  const dataAlarmeTimestamp = dataAlarme.getTime();
  
  // --- VALIDAÇÕES ---
  const { tickets = [] } = await chrome.storage.local.get("tickets");

  // *** 1. NOVA VALIDAÇÃO: Checa duplicidade de link (apenas se for um item novo) ***
  if (!editingId && tickets.some(t => t.link === link)) {
    alert("Este link já foi salvo como lembrete.");
    return;
  }
  
  // 2. Checa se a data/hora é no futuro (apenas se for um item novo)
  if (dataAlarmeTimestamp <= Date.now() && !editingId) {
    alert("Por favor, escolha um horário no futuro.");
    return;
  }
  
  if (editingId) {
    // --- LÓGICA DE ATUALIZAÇÃO ---
    const index = tickets.findIndex(t => t.id === editingId);
    if (index > -1) {
      // Remove o alarme antigo
      await chrome.alarms.clear(editingId);
      
      // Atualiza o item
      tickets[index] = { id: editingId, link, ticket, horario: dataAlarmeTimestamp };
      
      // Cria o novo alarme
      await chrome.alarms.create(editingId, { when: dataAlarmeTimestamp });
    }
  } else {
    // --- LÓGICA DE CRIAÇÃO (existente) ---
    await criarNovoLembrete(link, ticket, dataAlarmeTimestamp);
    return; // Retorna para evitar chamar resetForm/carregarTickets duas vezes
  }

  // Salva a lista (seja nova ou atualizada)
  await chrome.storage.local.set({ tickets });
  
  resetForm(); // Limpa o formulário
  carregarTickets(); // Recarrega a lista
};

/**
 * Evento de clique do botão "Lembrete em 1h"
 */
salvar1hBtn.onclick = async () => {
  const link = linkInput.value;
  const ticket = ticketInput.value;

  // Valida apenas os campos de texto
  if (!link || !ticket) {
    alert("Por favor, preencha o Link e a Descrição para criar um lembrete rápido.");
    return;
  }
  
  // *** NOVA VALIDAÇÃO: Checa duplicidade de link ***
  const { tickets = [] } = await chrome.storage.local.get("tickets");
  if (tickets.some(t => t.link === link)) {
    alert("Este link já foi salvo como lembrete.");
    return;
  }

  // Calcula o horário para daqui a 1 hora
  const dataAlarme = new Date();
  dataAlarme.setHours(dataAlarme.getHours() + 1);

  await criarNovoLembrete(link, ticket, dataAlarme.getTime());
};

/**
 * Evento de clique do botão "Cancelar Edição"
 */
cancelarBtn.onclick = () => {
  resetForm(); // Apenas reseta o formulário
};

/**
 * Evento de mudança do interruptor de som
 */
somAlertaToggle.onchange = async () => {
  const somAtivo = somAlertaToggle.checked;
  // Salva a configuração no storage
  await chrome.storage.local.set({ configuracoes: { somAtivo } });
};

/**
 * Carrega as configurações salvas e atualiza a UI.
 */
async function carregarConfiguracoes() {
  // Pega as configurações salvas. O valor padrão para somAtivo é 'true'.
  const { configuracoes = { somAtivo: true } } = await chrome.storage.local.get("configuracoes");
  somAlertaToggle.checked = configuracoes.somAtivo;
}


// --- Inicialização do Popup ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Carrega as configurações do usuário (ex: som ligado/desligado)
  carregarConfiguracoes();

  // 2. Para qualquer alarme piscante que esteja ativo e restaura o badge para a contagem
  pararAlarmeERestaurarBadge();

  // 3. Carrega e exibe a lista de tickets
  carregarTickets();
});