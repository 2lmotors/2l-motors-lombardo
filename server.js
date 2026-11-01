const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');
const gemini = require('./gemini');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret-key-2l-motors-lombardo-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true en HTTPS de production
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 jours
  }
}));

// Middleware de vérification d'authentification
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Vous devez être connecté pour accéder à ce service.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l’administration 2L Motors Lombardo.' });
  }
  next();
}

// ----------------------------------------------------
// ROUTES D'AUTHENTIFICATION
// ----------------------------------------------------

// Inscription
app.post('/api/auth/register', (req, res) => {
  const { nom, prenom, email, telephone, adresse, password } = req.body;
  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ error: 'Un compte existe déjà avec cette adresse email.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (nom, prenom, email, telephone, adresse, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?, 'client')
    `).run(nom.trim(), prenom.trim(), email.toLowerCase().trim(), telephone || '', adresse || '', hash);

    req.session.userId = result.lastInsertRowid;
    req.session.userRole = 'client';
    req.session.userName = `${prenom} ${nom}`;

    res.json({
      success: true,
      message: 'Compte créé avec succès !',
      user: {
        id: result.lastInsertRowid,
        nom,
        prenom,
        email: email.toLowerCase().trim(),
        role: 'client'
      }
    });
  } catch (err) {
    console.error('Erreur inscription:', err);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// Connexion
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = `${user.prenom} ${user.nom}`;

    res.json({
      success: true,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        adresse: user.adresse,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// Déconnexion
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Déconnecté avec succès.' });
  });
});

// Utilisateur courant
app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ loggedIn: false });
  }
  const user = db.prepare('SELECT id, nom, prenom, email, telephone, adresse, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.json({ loggedIn: false });
  }
  res.json({ loggedIn: true, user });
});

// ----------------------------------------------------
// SERVICES & TARIFS
// ----------------------------------------------------
app.get('/api/services', (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM services ORDER BY categorie, id').all();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer les tarifs.' });
  }
});

// ----------------------------------------------------
// VÉHICULES DU CLIENT
// ----------------------------------------------------
app.get('/api/vehicles', requireAuth, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY id DESC').all(req.session.userId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Erreur récupération véhicules.' });
  }
});

app.post('/api/vehicles', requireAuth, (req, res) => {
  const { immatriculation, marque, modele, annee, motorisation, kilometrage } = req.body;
  if (!immatriculation || !marque || !modele) {
    return res.status(400).json({ error: 'Immatriculation, marque et modèle requis.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO vehicles (user_id, immatriculation, marque, modele, annee, motorisation, kilometrage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      req.session.userId,
      immatriculation.toUpperCase().replace(/\s+/g, '-'),
      marque.trim(),
      modele.trim(),
      annee || null,
      motorisation || '',
      kilometrage || null
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Erreur ajout véhicule.' });
  }
});

// ----------------------------------------------------
// DEVIS (SOUMISSION & SUIVI)
// ----------------------------------------------------
app.get('/api/quotes', requireAuth, (req, res) => {
  try {
    const quotes = db.prepare(`
      SELECT q.*, s.titre as service_titre, v.marque as vehicule_marque, v.modele as vehicule_modele
      FROM quotes q
      LEFT JOIN services s ON q.service_id = s.id
      LEFT JOIN vehicles v ON q.vehicle_id = v.id
      WHERE q.user_id = ?
      ORDER BY q.created_at DESC
    `).all(req.session.userId);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: 'Erreur récupération des devis.' });
  }
});

app.post('/api/quotes', requireAuth, (req, res) => {
  const { service_id, service_ids, vehicle_id, immatriculation, description_panne, urgence, date_souhaitee } = req.body;
  
  const selectedIds = Array.isArray(service_ids) && service_ids.length > 0 
    ? service_ids 
    : (service_id ? [service_id] : []);

  if (!description_panne && selectedIds.length === 0) {
    return res.status(400).json({ error: 'Veuillez sélectionner au moins une prestation ou décrire votre besoin.' });
  }

  try {
    let montantTotal = 0;
    const servicesTitles = [];

    if (selectedIds.length > 0) {
      const placeholders = selectedIds.map(() => '?').join(',');
      const rows = db.prepare(`SELECT id, titre, prix_indicatif FROM services WHERE id IN (${placeholders})`).all(...selectedIds);
      
      rows.forEach(s => {
        montantTotal += (s.prix_indicatif || 0);
        servicesTitles.push(`${s.titre} (${(s.prix_indicatif || 0).toFixed(2)} CHF)`);
      });
    }

    // Préparer le texte de description combiné
    let descriptionComplete = description_panne ? description_panne.trim() : '';
    if (servicesTitles.length > 0) {
      const headerPrestations = `Prestations sélectionnées :\n• ${servicesTitles.join('\n• ')}`;
      descriptionComplete = descriptionComplete 
        ? `${headerPrestations}\n\nRemarques / Symptômes :\n${descriptionComplete}`
        : headerPrestations;
    }

    const primaryServiceId = selectedIds.length > 0 ? selectedIds[0] : null;

    const stmt = db.prepare(`
      INSERT INTO quotes (user_id, vehicle_id, service_id, immatriculation, description_panne, urgence, date_souhaitee, montant_estime, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')
    `);

    const result = stmt.run(
      req.session.userId,
      vehicle_id || null,
      primaryServiceId,
      immatriculation ? immatriculation.toUpperCase().trim() : '',
      descriptionComplete || 'Demande de devis forfaitaire',
      urgence || 'normale',
      date_souhaitee || null,
      montantTotal > 0 ? montantTotal : null
    );

    res.json({ 
      success: true, 
      quoteId: result.lastInsertRowid, 
      montantEstime: montantTotal,
      message: 'Votre demande de devis a bien été transmise à 2L MOTORS LOMBARDO !' 
    });
  } catch (err) {
    console.error('Erreur création devis:', err);
    res.status(500).json({ error: 'Erreur lors de la création du devis.' });
  }
});

// Accepter ou refuser un devis par le client
app.patch('/api/quotes/:id/client-action', requireAuth, (req, res) => {
  const { action } = req.body; // 'accepte' ou 'refuse'
  if (!['accepte', 'refuse'].includes(action)) {
    return res.status(400).json({ error: 'Action invalide.' });
  }

  try {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!quote) {
      return res.status(404).json({ error: 'Devis introuvable.' });
    }

    db.prepare('UPDATE quotes SET statut = ? WHERE id = ?').run(action, req.params.id);
    res.json({ success: true, message: `Devis marqué comme ${action}.` });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour devis.' });
  }
});

// ----------------------------------------------------
// SERVICE APRÈS-VENTE (SAV & TICKETS)
// ----------------------------------------------------
app.get('/api/sav', requireAuth, (req, res) => {
  try {
    const tickets = db.prepare(`
      SELECT t.*, q.immatriculation as quote_immat
      FROM sav_tickets t
      LEFT JOIN quotes q ON t.quote_id = q.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `).all(req.session.userId);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Erreur récupération tickets SAV.' });
  }
});

app.post('/api/sav', requireAuth, (req, res) => {
  const { titre, description, quote_id, priorite } = req.body;
  if (!titre || !description) {
    return res.status(400).json({ error: 'Titre et description requis pour le SAV.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO sav_tickets (user_id, quote_id, titre, description, priorite, statut)
      VALUES (?, ?, ?, ?, ?, 'ouvert')
    `);
    const info = stmt.run(req.session.userId, quote_id || null, titre.trim(), description.trim(), priorite || 'normale');
    res.json({ success: true, ticketId: info.lastInsertRowid, message: 'Dossier SAV ouvert auprès de notre équipe technique.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur création ticket SAV.' });
  }
});

// ----------------------------------------------------
// ADMINISTRATION (GARAGE 2L MOTORS)
// ----------------------------------------------------
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'client'").get().count;
    const quotesWaiting = db.prepare("SELECT COUNT(*) as count FROM quotes WHERE statut = 'en_attente'").get().count;
    const savOpen = db.prepare("SELECT COUNT(*) as count FROM sav_tickets WHERE statut IN ('ouvert', 'en_cours')").get().count;
    const allQuotes = db.prepare(`
      SELECT q.*, u.nom, u.prenom, u.telephone, u.email, s.titre as service_titre
      FROM quotes q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN services s ON q.service_id = s.id
      ORDER BY q.created_at DESC
    `).all();
    const allSav = db.prepare(`
      SELECT t.*, u.nom, u.prenom, u.telephone, u.email
      FROM sav_tickets t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `).all();
    const allClients = db.prepare(`
      SELECT id, nom, prenom, email, telephone, adresse, created_at
      FROM users WHERE role = 'client'
      ORDER BY created_at DESC
    `).all();

    res.json({
      stats: { totalUsers, quotesWaiting, savOpen },
      quotes: allQuotes,
      savTickets: allSav,
      clients: allClients
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur récupération données admin.' });
  }
});

// Mise à jour d'un devis par le garage (chiffrage, statut, remarques)
app.patch('/api/admin/quotes/:id', requireAdmin, (req, res) => {
  const { montant_estime, statut, commentaires_garage } = req.body;
  try {
    db.prepare(`
      UPDATE quotes 
      SET montant_estime = COALESCE(?, montant_estime),
          statut = COALESCE(?, statut),
          commentaires_garage = COALESCE(?, commentaires_garage)
      WHERE id = ?
    `).run(montant_estime, statut, commentaires_garage, req.params.id);

    res.json({ success: true, message: 'Devis mis à jour par l’atelier.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour devis.' });
  }
});

// Réponse SAV par le garage
app.patch('/api/admin/sav/:id', requireAdmin, (req, res) => {
  const { statut, reponse_garage } = req.body;
  try {
    db.prepare(`
      UPDATE sav_tickets 
      SET statut = COALESCE(?, statut),
          reponse_garage = COALESCE(?, reponse_garage)
      WHERE id = ?
    `).run(statut, reponse_garage, req.params.id);

    res.json({ success: true, message: 'Ticket SAV mis à jour.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour SAV.' });
  }
});

// ----------------------------------------------------
// IA GOOGLE GEMINI - CHATBOT CONSEIL
// ----------------------------------------------------
app.post('/api/chat/ai', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message requis' });
  }

  try {
    const result = await gemini.askGemini(message, history || []);
    res.json(result);
  } catch (err) {
    console.error('Erreur chat AI:', err);
    res.status(500).json({ error: 'Erreur lors du traitement IA' });
  }
});

app.get('/api/admin/gemini-status', requireAdmin, (req, res) => {
  const key = gemini.getApiKey();
  res.json({
    configured: !!key,
    maskedKey: key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : ''
  });
});

app.post('/api/admin/gemini-key', requireAdmin, (req, res) => {
  const { apiKey } = req.body;
  if (typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'Clé API invalide' });
  }
  const ok = gemini.saveApiKey(apiKey);
  res.json({ success: ok, configured: !!apiKey.trim() });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚗 2L MOTORS LOMBARDO - Serveur démarré !`);
  console.log(`🔗 Accès Web : http://localhost:${PORT}`);
  console.log(`🔑 Compte Admin : ticino1996@hotmail.com / admin123`);
  console.log(`===============================================`);
});

