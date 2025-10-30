// --- Elementos do DOM ---
const salvarBtn = document.getElementById("salvar");
const cancelarBtn = document.getElementById("cancelar"); // Novo
const linkInput = document.getElementById("link");
const ticketInput = document.getElementById("ticket");
const horarioInput = document.getElementById("horario");
const listaUl = document.getElementById("lista-tickets");

// --- Variáveis de Estado ---
let editingId = null; // Controla se estamos em modo de edição
const COR_PADRAO = "#FF0000"; // Vermelho (para consistência)

// --- Funções Auxiliares ---

/**
 * Converte um timestamp (milisegundos) para o formato YYYY-MM-DDTHH:MM
 * exigido pelo input 'datetime-local'.
 */
function toLocalISOString(timestamp) {
  const date = new Date(timestamp);
  const pad = (num) => String(num).padStart(2, '0');
  
  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  
  return `${Y}-${M}-${D}T${h}:${m}`;
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
  await chrome.alarms.clear("PISCAR_BADGE");
  
  const { tickets = [] } = await chrome.storage.local.get("tickets");
  await chrome.action.setBadgeText({ text: tickets.length > 0 ? String(tickets.length) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: COR_PADRAO });
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
        horarioInput.value = toLocalISOString(item.horario); // Usa a função auxiliar
        
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
  await pararAlarmeERestaurarBadge();
}

// --- Event Listeners do Formulário ---

/**
 * Evento de clique do botão "Salvar Lembrete" ou "Atualizar Lembrete"
 */
salvarBtn.onclick = async () => {
  const link = linkInput.value;
  const ticket = ticketInput.value;
  const horario = horarioInput.value;

  if (!link || !ticket || !horario) {
    alert("Por favor, preencha todos os campos.");
    return; 
  }

  const dataAlarme = new Date(horario).getTime();
  
  if (dataAlarme <= Date.now() && !editingId) {
    alert("Por favor, escolha uma data/hora no futuro.");
    return;
  }

  const { tickets = [] } = await chrome.storage.local.get("tickets");
  
  if (editingId) {
    // --- LÓGICA DE ATUALIZAÇÃO ---
    const index = tickets.findIndex(t => t.id === editingId);
    if (index > -1) {
      // Remove o alarme antigo
      await chrome.alarms.clear(editingId);
      
      // Atualiza o item
      tickets[index] = { id: editingId, link, ticket, horario: dataAlarme };
      
      // Cria o novo alarme
      await chrome.alarms.create(editingId, { when: dataAlarme });
    }
  } else {
    // --- LÓGICA DE CRIAÇÃO (existente) ---
    const id = `lembrete_${Date.now()}`;
    tickets.push({ id, link, ticket, horario: dataAlarme });
    await chrome.alarms.create(id, { when: dataAlarme });
  }

  // Salva a lista (seja nova ou atualizada)
  await chrome.storage.local.set({ tickets });
  
  resetForm(); // Limpa o formulário
  carregarTickets(); // Recarrega a lista
};

/**
 * Evento de clique do botão "Cancelar Edição"
 */
cancelarBtn.onclick = () => {
  resetForm(); // Apenas reseta o formulário
};

// --- Inicialização do Popup ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Para qualquer alarme piscante e restaura o badge
  // 2. Carrega a lista de tickets
  carregarTickets();
});