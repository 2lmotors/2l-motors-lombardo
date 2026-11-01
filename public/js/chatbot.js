// Chatbot Interactif 2L MOTORS LOMBARDO avec IA Google Gemini
const chatHistory = [];

let chatState = {
  step: 'INITIAL',
  flow: null, // 'QUOTE' ou 'SAV'
  data: {
    serviceId: null,
    serviceTitle: '',
    immatriculation: '',
    description: '',
    urgence: 'normale',
    date: ''
  }
};

function scrollChatToBottom() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.scrollTop = container.scrollHeight;
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 50);
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 200);
}

function toggleChatBot() {
  const widget = document.getElementById('chatWidget');
  if (!widget) return;
  if (widget.style.display === 'flex') {
    widget.style.display = 'none';
  } else {
    widget.style.display = 'flex';
    const msgs = document.getElementById('chatMessages');
    if (msgs.children.length === 0) {
      greetUser();
    } else {
      scrollChatToBottom();
    }
    const input = document.getElementById('chatInput');
    if (input) input.focus();
  }
}

function openChatBot(mode) {
  const widget = document.getElementById('chatWidget');
  if (widget) {
    widget.style.display = 'flex';
    const msgs = document.getElementById('chatMessages');
    if (msgs.children.length === 0) {
      greetUser();
    } else {
      scrollChatToBottom();
    }
  }
  if (mode === 'devis') {
    startQuoteFlow();
  } else if (mode === 'sav') {
    startSavFlow();
  }
}

function addBotMessage(text, quickActions = []) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  chatHistory.push({ sender: 'bot', text: text.replace(/<[^>]*>?/gm, '') });

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg bot';
  msgDiv.innerHTML = `<div>${text}</div>`;

  if (quickActions.length > 0) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'chat-quick-actions';
    quickActions.forEach(act => {
      const btn = document.createElement('button');
      btn.className = 'chat-btn-action';
      btn.textContent = act.label;
      btn.onclick = act.action;
      actionsDiv.appendChild(btn);
    });
    msgDiv.appendChild(actionsDiv);
  }

  container.appendChild(msgDiv);
  scrollChatToBottom();
}

function addUserMessage(text) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  chatHistory.push({ sender: 'user', text });

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg user';
  msgDiv.textContent = text;
  container.appendChild(msgDiv);
  scrollChatToBottom();
}

function greetUser() {
  const name = currentUser ? `Bonjour ${currentUser.prenom}` : 'Bonjour et bienvenue chez 2L MOTORS LOMBARDO';
  addBotMessage(
    `${name} ! 👨‍🔧<br>Je suis <strong>Léo</strong>, votre mécanicien conseil virtuel. Que puis-je faire pour vous aujourd'hui ?`,
    [
      { label: '📋 Demander un devis', action: () => startQuoteFlow() },
      { label: '🛠️ Service Après-Vente (SAV)', action: () => startSavFlow() },
      { label: '🕒 Horaires & Adresse', action: () => showContactInfo() }
    ]
  );
}

function showContactInfo() {
  addUserMessage("Horaires & Coordonnées");
  addBotMessage(
    "📍 <strong>2L MOTORS LOMBARDO</strong><br>Chemin de la Biole 10, 1860 Aigle (Suisse)<br>📞 <strong>+41 76 346 65 01</strong><br>✉️ ticino1996@hotmail.com<br><br>🕒 <strong>Horaires d'ouverture :</strong><br>• Lun - Ven : 07h30 - 12h00 &bull; 13h30 - 18h00<br>• Samedi : 07h30 - 12h00",
    [
      { label: '📋 Demander un devis', action: () => startQuoteFlow() },
      { label: '🛠️ Signaler un problème SAV', action: () => startSavFlow() }
    ]
  );
}

// Flow Devis
function startQuoteFlow() {
  addUserMessage("Je souhaite demander un devis de réparation");
  chatState.flow = 'QUOTE';
  chatState.step = 'ASK_SERVICE_TYPE';

  addBotMessage(
    "Quel type d'intervention concerne votre véhicule ?",
    [
      { label: '🔧 Révision / Vidange', action: () => chooseServiceType('Révision / Vidange') },
      { label: '🛑 Freins (Plaquettes/Disques)', action: () => chooseServiceType('Freinage') },
      { label: '⚙️ Distribution / Moteur', action: () => chooseServiceType('Distribution') },
      { label: '❄️ Climatisation', action: () => chooseServiceType('Climatisation') },
      { label: '⚠️ Recherche de panne / Autre', action: () => chooseServiceType('Panne spécifique') }
    ]
  );
}

function startChatWithService(serviceId, serviceTitle) {
  openChatBot();
  chatState.flow = 'QUOTE';
  chatState.data.serviceId = serviceId;
  chatState.data.serviceTitle = serviceTitle;
  
  addUserMessage(`Je souhaite un devis pour : ${serviceTitle}`);
  chatState.step = 'ASK_PLATE';
  
  setTimeout(() => {
    addBotMessage(`Très bon choix ! Pour préparer votre devis pour <strong>${serviceTitle}</strong>, quelle est l'<strong>immatriculation</strong> de votre véhicule (ex: AB-123-CD) ou sa marque et son modèle ?`);
  }, 400);
}

function chooseServiceType(type) {
  addUserMessage(type);
  chatState.data.serviceTitle = type;
  chatState.step = 'ASK_PLATE';
  addBotMessage(`C'est noté pour la catégorie <strong>${type}</strong>.<br>Pouvez-vous me donner l'<strong>immatriculation</strong> de votre véhicule (ex: AB-123-CD) ou sa marque et son modèle ?`);
}

// Flow SAV
function startSavFlow() {
  addUserMessage("J'ai une demande pour le Service Après-Vente");
  chatState.flow = 'SAV';
  chatState.step = 'SAV_ASK_DETAILS';
  addBotMessage("Nous accordons la plus grande importance à votre satisfaction. Décrivez-moi le problème constaté sur votre véhicule après réparation :");
}

// Gestion des messages tapés par l'utilisateur
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  addUserMessage(text);

  // Traitement selon étape
  if (chatState.flow === 'QUOTE') {
    if (chatState.step === 'ASK_PLATE') {
      chatState.data.immatriculation = text;
      chatState.step = 'ASK_DESCRIPTION';
      addBotMessage("Merci ! Précisez brièvement les détails ou symptômes éventuels (ex: bruit, kilométrage, voyant, date souhaitée...) :");
    } 
    else if (chatState.step === 'ASK_DESCRIPTION') {
      chatState.data.description = text;
      await finalizeQuote();
    }
  } 
  else if (chatState.flow === 'SAV') {
    if (chatState.step === 'SAV_ASK_DETAILS') {
      chatState.data.description = text;
      await finalizeSav();
    }
  } 
  else {
    // Message libre : transmission au chef d'atelier IA Google Gemini
    const typingId = 'typing-' + Date.now();
    const container = document.getElementById('chatMessages');
    if (container) {
      const typingDiv = document.createElement('div');
      typingDiv.id = typingId;
      typingDiv.className = 'chat-msg bot';
      typingDiv.innerHTML = `<span style="color: #94a3b8; font-style: italic;">Léo analyse votre demande... 🔧</span>`;
      container.appendChild(typingDiv);
      scrollChatToBottom();
    }

    try {
      const priorHistory = chatHistory.slice(0, -1);
      const res = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: priorHistory })
      });
      const data = await res.json();

      // Supprimer indicateur de frappe
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();

      const formattedReply = (data.reply || "Je suis à votre écoute pour toute question technique ou demande de devis.")
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      addBotMessage(formattedReply, [
        { label: '📋 Demander un devis', action: () => startQuoteFlow() },
        { label: '🛠️ Question SAV', action: () => startSavFlow() },
        { label: '📍 Contact & Horaires', action: () => showContactInfo() }
      ]);
    } catch (err) {
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();
      addBotMessage("Une petite erreur est survenue lors de l'analyse. Que souhaitez-vous faire ?", [
        { label: '📋 Faire un devis', action: () => startQuoteFlow() },
        { label: '🛠️ Ticket SAV', action: () => startSavFlow() }
      ]);
    }
  }
}

async function finalizeQuote() {
  addBotMessage("⏳ Enregistrement de votre demande de devis en cours...");

  // Vérifier si connecté
  if (!currentUser) {
    // Sauvegarde temporaire en local pour la récupérer après connexion
    sessionStorage.setItem('pendingQuote', JSON.stringify(chatState.data));

    setTimeout(() => {
      addBotMessage(
        `Votre demande de devis pour votre véhicule (<strong>${chatState.data.immatriculation}</strong>) est prête !<br><br>` +
        `Pour que notre atelier 2L Motors puisse chiffrer votre intervention et vous envoyer la proposition, <strong>vous devez vous inscrire ou vous connecter</strong>.`,
        [
          { label: '🔑 Créer mon compte / Me connecter', action: () => window.location.href = '/login.html' }
        ]
      );
    }, 600);
    return;
  }

  // Si connecté, on crée le devis directement
  try {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: chatState.data.serviceId,
        immatriculation: chatState.data.immatriculation,
        description_panne: `${chatState.data.serviceTitle ? chatState.data.serviceTitle + ' : ' : ''}${chatState.data.description}`,
        urgence: chatState.data.urgence
      })
    });
    const result = await res.json();
    if (res.ok) {
      addBotMessage(
        `✅ <strong>Parfait ! Votre devis #${result.quoteId} est enregistré !</strong><br>` +
        `L'équipe 2L MOTORS LOMBARDO étudie votre demande. Vous pouvez suivre l'avancement en direct sur votre espace client.`,
        [
          { label: 'Voir mon espace client', action: () => window.location.href = '/dashboard.html' }
        ]
      );
    } else {
      addBotMessage(`⚠️ ${result.error || 'Erreur lors de l’envoi du devis.'}`);
    }
  } catch (err) {
    addBotMessage("Une erreur réseau est survenue. Veuillez réessayer.");
  }
}

async function finalizeSav() {
  addBotMessage("⏳ Prise en charge de votre dossier SAV...");

  if (!currentUser) {
    addBotMessage(
      `Pour traiter votre réclamation SAV avec le dossier de votre véhicule, veuillez vous connecter ou créer un compte.`,
      [
        { label: '🔑 Me connecter / M’inscrire', action: () => window.location.href = '/login.html' }
      ]
    );
    return;
  }

  try {
    const res = await fetch('/api/sav', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titre: 'Demande SAV transmise via le Chatbot',
        description: chatState.data.description,
        priorite: 'urgente'
      })
    });
    const result = await res.json();
    if (res.ok) {
      addBotMessage(
        `✅ <strong>Dossier SAV #${result.ticketId} ouvert avec succès !</strong><br>` +
        `Notre chef d'atelier examine votre signalement en priorité. Vous recevrez une réponse directement sur votre espace client.`,
        [
          { label: 'Accéder à mes dossiers SAV', action: () => window.location.href = '/dashboard.html' }
        ]
      );
    } else {
      addBotMessage(`⚠️ ${result.error || 'Erreur lors de la création du ticket SAV.'}`);
    }
  } catch (err) {
    addBotMessage("Une erreur réseau est survenue. Veuillez réessayer.");
  }
}

