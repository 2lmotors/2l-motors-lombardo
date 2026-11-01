const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

const configPath = path.join(__dirname, 'gemini-config.json');

function getApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.apiKey) return data.apiKey.trim();
    }
  } catch (e) {
    console.error('Erreur lecture gemini-config.json:', e);
  }
  return '';
}

function saveApiKey(newKey) {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ apiKey: newKey.trim() }, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Erreur écriture gemini-config.json:', e);
    return false;
  }
}

function buildSystemPrompt() {
  // Récupérer les services et tarifs en direct depuis la base SQLite
  let servicesTxt = '';
  try {
    const services = db.prepare('SELECT categorie, titre, prix_indicatif, description FROM services').all();
    servicesTxt = services.map(s => `- ${s.titre} (${s.categorie}) : dès ${s.prix_indicatif.toFixed(2)} CHF (Description: ${s.description})`).join('\n');
  } catch (e) {
    servicesTxt = 'Consultez notre grille de forfaits sur le site.';
  }

  return `Tu es Léo, le mécanicien virtuel et chef d'atelier de 2L MOTORS LOMBARDO.
Tu es représenté par un petit bonhomme en salopette bleue d'atelier avec une casquette 2L rouge.

INFORMATIONS SUR LE GARAGE :
- Nom : 2L MOTORS LOMBARDO
- Adresse : Chemin de la Biole 10, 1860 Aigle (Canton de Vaud, Suisse)
- Téléphone : +41 76 346 65 01
- Email : ticino1996@hotmail.com
- Horaires : Lundi au Vendredi de 07h30 à 12h00 et de 13h30 à 18h00. Samedi de 07h30 à 12h00. Dimanche fermé.
- Devise : Tous les prix sont en CHF (Francs Suisses).

GRILLE DES PRESTATIONS & FORFAITS DE L'ATELIER :
${servicesTxt}

TES MISSIONS :
1. Accueil chaleureux, professionnel et rassurant avec une touche d'expertise mécanique.
2. Pré-diagnostic intelligent : Si le client décrit un bruit, un voyant ou une panne, explique-lui simplement les causes probables et recommande la bonne prestation (ex: Diagnostic Valise à 49 CHF, freinage, géométrie à 100 CHF, vidange à 160 CHF, etc.).
3. Orientation devis : Encourage-le à remplir sa demande de devis en ligne sur le site ou propose-lui de noter son immatriculation pour préparer son dossier.
4. Concision : Sois toujours clair, direct et concis (environ 2 à 4 phrases par réponse). Évite les longs pavés théoriques.
5. Langues : Si le visiteur s'exprime en anglais, allemand ou italien, réponds-lui naturellement dans sa langue en restant basé en Suisse.`;
}

async function askGemini(userMessage, conversationHistory = []) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      success: false,
      isConfigured: false,
      reply: "Bonjour ! Mon cerveau IA Google Gemini est prêt à être activé. Pour l'activer, renseignez simplement votre clé API Gemini dans le panneau d'administration du garage (ou dans gemini-config.json). En attendant, je peux enregistrer votre demande de devis ou de SAV via les boutons ci-dessous !"
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: buildSystemPrompt()
    });

    // Formatage de l'historique récent (limité aux 6 derniers échanges)
    const formattedHistory = [];
    const recentHistory = conversationHistory.slice(-6);

    recentHistory.forEach(item => {
      if (item.sender === 'user') {
        formattedHistory.push({ role: 'user', parts: [{ text: item.text }] });
      } else if (item.sender === 'bot') {
        formattedHistory.push({ role: 'model', parts: [{ text: item.text }] });
      }
    });

    const chat = model.startChat({
      history: formattedHistory
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const text = response.text();

    return {
      success: true,
      isConfigured: true,
      reply: text
    };
  } catch (err) {
    console.error('Erreur API Gemini:', err);
    return {
      success: false,
      isConfigured: true,
      error: err.message,
      reply: "Je rencontre une petite difficulté momentanée de connexion avec Google Gemini. N'hésitez pas à nous appeler directement au +41 76 346 65 01 ou à utiliser les boutons de devis direct ci-dessous !"
    };
  }
}

module.exports = {
  getApiKey,
  saveApiKey,
  askGemini
};

