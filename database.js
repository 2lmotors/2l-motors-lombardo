const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
}

const dbFile = path.join(dataDir, 'database.json');

// Structure en mémoire
let store = {
  users: [],
  vehicles: [],
  services: [],
  quotes: [],
  sav_tickets: []
};

// Chargement depuis le fichier JSON s'il existe
function loadDb() {
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf8');
      store = Object.assign(store, JSON.parse(content));
    } catch (e) {
      console.error('Erreur lecture database.json:', e);
    }
  }
}

// Sauvegarde atomique synchrone
function saveDb() {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Erreur sauvegarde database.json:', e);
  }
}

loadDb();

// Initialisation des données par défaut
function initDb() {
  // Services & Tarifs par défaut
  if (!store.services || store.services.length === 0) {
    store.services = [
      { id: 1, categorie: 'Entretien Courant', titre: 'Vidange & Filtre à huile', description: 'Huile moteur synthétique certifiée constructeur + remplacement du filtre à huile + 30 points de contrôle.', prix_indicatif: 160.00, duree_estimee: '45 min', inclus: 'Huile homologuée, filtre, remise à zéro témoin vidange' },
      { id: 2, categorie: 'Entretien Courant', titre: 'Révision Complète Constructeur', description: 'Vidange, filtre à huile, filtre à air, filtre d’habitacle, contrôle freinage, batterie et niveaux.', prix_indicatif: 240.00, duree_estimee: '1h30', inclus: '4 filtres selon modèle, diagnostic électronique, garantie constructeur préservée' },
      { id: 3, categorie: 'Freinage', titre: 'Plaquettes de frein avant', description: 'Contrôle des disques et remplacement des plaquettes avant de qualité origine.', prix_indicatif: 119.00, duree_estimee: '1h', inclus: 'Plaquettes qualité première monte, dépoussiérage, contrôle liquide de frein' },
      { id: 4, categorie: 'Freinage', titre: 'Disques + Plaquettes avant', description: 'Remplacement complet du train avant de freinage pour une sécurité optimale.', prix_indicatif: 249.00, duree_estimee: '1h30', inclus: 'Disques ventilés/pleins, plaquettes, purge éventuelle' },
      { id: 5, categorie: 'Climatisation', titre: 'Entretien & Recharge Climatisation', description: 'Tirage au vide, test d’étanchéité et recharge en fluide frigorigène R134a ou R1234yf.', prix_indicatif: 120.00, duree_estimee: '45 min', inclus: 'Recharge gaz, traitement antibactérien de l’habitacle' },
      { id: 6, categorie: 'Moteur & Distribution', titre: 'Kit de Distribution + Pompe à eau', description: 'Remplacement préventif courroie, galets tendeurs, pompe à eau et nouveau liquide de refroidissement.', prix_indicatif: 490.00, duree_estimee: '4h', inclus: 'Courroie, galets, pompe, liquide de refroidissement neuf, garantie 1 an' },
      { id: 7, categorie: 'Diagnostic', titre: 'Diagnostic Électronique Valise', description: 'Passage à la valise multimarque dernière génération, lecture et effacement des codes défauts.', prix_indicatif: 49.00, duree_estimee: '30 min', inclus: 'Rapport de diagnostic imprimé ou envoyé par email' },
      { id: 8, categorie: 'Pneumatiques', titre: 'Montage & Équilibrage (par pneu)', description: 'Démontage de l’ancien pneu, valve neuve, montage, équilibrage dynamique.', prix_indicatif: 20.00, duree_estimee: '20 min', inclus: 'Valve neuve, équilibrage au gramme près, recyclage pneu usagé' },
      { id: 9, categorie: 'Châssis & Liaison au sol', titre: 'Géométrie & Parallélisme', description: 'Réglage des trains avant et arrière au banc laser pour préserver les pneus et la trajectoire.', prix_indicatif: 100.00, duree_estimee: '45 min', inclus: 'Rapport avant/après réglages laser' }
    ];
  }

  // Admin par défaut
  const adminEmail = 'ticino1996@hotmail.com';
  let admin = store.users.find(u => u.email.toLowerCase() === adminEmail);
  if (!admin) {
    const adminPass = bcrypt.hashSync('admin123', 10);
    store.users.push({
      id: 1,
      email: adminEmail,
      password_hash: adminPass,
      nom: 'LOMBARDO',
      prenom: 'Mario',
      telephone: '+41 76 346 65 01',
      adresse: 'Chemin de la Biole 10, 1860 Aigle',
      role: 'admin',
      created_at: new Date().toISOString()
    });
  }

  saveDb();
}

initDb();

// Adaptateur d'interface compatible SQLite (prepare, run, get, all, exec)
const db = {
  pragma: () => {},
  exec: () => {},
  transaction: (fn) => (items) => {
    fn(items);
    saveDb();
  },
  prepare: (sql) => {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    return {
      get: (...params) => {
        // Users
        if (cleanSql.includes('FROM users WHERE email = ?')) {
          const email = (params[0] || '').toLowerCase().trim();
          return store.users.find(u => u.email.toLowerCase() === email);
        }
        if (cleanSql.includes('FROM users WHERE id = ?')) {
          return store.users.find(u => u.id === parseInt(params[0]));
        }
        if (cleanSql.includes("FROM users WHERE role = 'admin'")) {
          return store.users.find(u => u.role === 'admin');
        }
        if (cleanSql.includes("COUNT(*) as count FROM users WHERE role = 'client'")) {
          const count = store.users.filter(u => u.role === 'client').length;
          return { count };
        }

        // Services
        if (cleanSql.includes('COUNT(*) as count FROM services')) {
          return { count: store.services.length };
        }
        if (cleanSql.includes('FROM services WHERE id = ?')) {
          return store.services.find(s => s.id === parseInt(params[0]));
        }

        // Quotes
        if (cleanSql.includes("COUNT(*) as count FROM quotes WHERE statut = 'en_attente'")) {
          const count = store.quotes.filter(q => q.statut === 'en_attente').length;
          return { count };
        }
        if (cleanSql.includes('FROM quotes WHERE id = ? AND user_id = ?')) {
          const qId = parseInt(params[0]);
          const uId = parseInt(params[1]);
          return store.quotes.find(q => q.id === qId && q.user_id === uId);
        }

        // SAV
        if (cleanSql.includes("COUNT(*) as count FROM sav_tickets WHERE statut IN ('ouvert', 'en_cours')")) {
          const count = store.sav_tickets.filter(t => t.statut === 'ouvert' || t.statut === 'en_cours').length;
          return { count };
        }

        return undefined;
      },

      all: (...params) => {
        // Services
        if (cleanSql.includes('FROM services') && cleanSql.includes('IN (')) {
          const ids = params.map(p => parseInt(p));
          return store.services.filter(s => ids.includes(s.id));
        }
        if (cleanSql.includes('FROM services')) {
          return [...store.services].sort((a, b) => a.id - b.id);
        }

        // Vehicles
        if (cleanSql.includes('FROM vehicles WHERE user_id = ?')) {
          const uId = parseInt(params[0]);
          return store.vehicles.filter(v => v.user_id === uId).sort((a, b) => b.id - a.id);
        }

        // Quotes
        if (cleanSql.includes('FROM quotes') && cleanSql.includes('WHERE q.user_id = ?')) {
          const uId = parseInt(params[0]);
          return store.quotes
            .filter(q => q.user_id === uId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(q => {
              const serv = store.services.find(s => s.id === q.service_id);
              const veh = store.vehicles.find(v => v.id === q.vehicle_id);
              return {
                ...q,
                service_titre: serv ? serv.titre : null,
                vehicule_marque: veh ? veh.marque : null,
                vehicule_modele: veh ? veh.modele : null
              };
            });
        }
        if (cleanSql.includes('FROM quotes q JOIN users u')) {
          return store.quotes
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(q => {
              const u = store.users.find(user => user.id === q.user_id) || {};
              const serv = store.services.find(s => s.id === q.service_id);
              return {
                ...q,
                nom: u.nom,
                prenom: u.prenom,
                telephone: u.telephone,
                email: u.email,
                service_titre: serv ? serv.titre : null
              };
            });
        }

        // SAV
        if (cleanSql.includes('FROM sav_tickets') && cleanSql.includes('WHERE t.user_id = ?')) {
          const uId = parseInt(params[0]);
          return store.sav_tickets
            .filter(t => t.user_id === uId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(t => {
              const q = store.quotes.find(quote => quote.id === t.quote_id);
              return { ...t, quote_immat: q ? q.immatriculation : null };
            });
        }
        if (cleanSql.includes('FROM sav_tickets t JOIN users u')) {
          return store.sav_tickets
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(t => {
              const u = store.users.find(user => user.id === t.user_id) || {};
              return {
                ...t,
                nom: u.nom,
                prenom: u.prenom,
                telephone: u.telephone,
                email: u.email
              };
            });
        }

        // Clients
        if (cleanSql.includes("FROM users WHERE role = 'client'")) {
          return store.users
            .filter(u => u.role === 'client')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return [];
      },

      run: (...params) => {
        // Insert User
        if (cleanSql.includes('INSERT INTO users')) {
          const newId = store.users.length > 0 ? Math.max(...store.users.map(u => u.id)) + 1 : 1;
          const user = {
            id: newId,
            nom: params[0],
            prenom: params[1],
            email: params[2],
            telephone: params[3],
            adresse: params[4],
            password_hash: params[5],
            role: params[6] || 'client',
            created_at: new Date().toISOString()
          };
          store.users.push(user);
          saveDb();
          return { lastInsertRowid: newId, changes: 1 };
        }

        // Insert Vehicle
        if (cleanSql.includes('INSERT INTO vehicles')) {
          const newId = store.vehicles.length > 0 ? Math.max(...store.vehicles.map(v => v.id)) + 1 : 1;
          const vehicle = {
            id: newId,
            user_id: parseInt(params[0]),
            immatriculation: params[1],
            marque: params[2],
            modele: params[3],
            annee: params[4] ? parseInt(params[4]) : null,
            motorisation: params[5] || '',
            kilometrage: params[6] ? parseInt(params[6]) : null
          };
          store.vehicles.push(vehicle);
          saveDb();
          return { lastInsertRowid: newId, changes: 1 };
        }

        // Insert Quote
        if (cleanSql.includes('INSERT INTO quotes')) {
          const newId = store.quotes.length > 0 ? Math.max(...store.quotes.map(q => q.id)) + 1 : 1;
          const quote = {
            id: newId,
            user_id: parseInt(params[0]),
            vehicle_id: params[1] ? parseInt(params[1]) : null,
            service_id: params[2] ? parseInt(params[2]) : null,
            immatriculation: params[3] || '',
            description_panne: params[4],
            urgence: params[5] || 'normale',
            date_souhaitee: params[6] || null,
            montant_estime: params[7] ? parseFloat(params[7]) : null,
            statut: params[8] || 'en_attente',
            commentaires_garage: '',
            created_at: new Date().toISOString()
          };
          store.quotes.push(quote);
          saveDb();
          return { lastInsertRowid: newId, changes: 1 };
        }

        // Update Quote client-action (accepte / refuse)
        if (cleanSql.includes('UPDATE quotes SET statut = ? WHERE id = ?')) {
          const statut = params[0];
          const id = parseInt(params[1]);
          const q = store.quotes.find(quote => quote.id === id);
          if (q) {
            q.statut = statut;
            saveDb();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        // Update Quote Admin
        if (cleanSql.includes('UPDATE quotes') && cleanSql.includes('montant_estime = COALESCE')) {
          const montant_estime = params[0] !== undefined && params[0] !== null ? parseFloat(params[0]) : null;
          const statut = params[1];
          const commentaires_garage = params[2];
          const id = parseInt(params[3]);
          const q = store.quotes.find(quote => quote.id === id);
          if (q) {
            if (montant_estime !== null && !isNaN(montant_estime)) q.montant_estime = montant_estime;
            if (statut) q.statut = statut;
            if (commentaires_garage !== undefined) q.commentaires_garage = commentaires_garage;
            saveDb();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        // Insert SAV
        if (cleanSql.includes('INSERT INTO sav_tickets')) {
          const newId = store.sav_tickets.length > 0 ? Math.max(...store.sav_tickets.map(t => t.id)) + 1 : 1;
          const ticket = {
            id: newId,
            user_id: parseInt(params[0]),
            quote_id: params[1] ? parseInt(params[1]) : null,
            titre: params[2],
            description: params[3],
            priorite: params[4] || 'normale',
            statut: params[5] || 'ouvert',
            reponse_garage: '',
            created_at: new Date().toISOString()
          };
          store.sav_tickets.push(ticket);
          saveDb();
          return { lastInsertRowid: newId, changes: 1 };
        }

        // Update SAV Admin
        if (cleanSql.includes('UPDATE sav_tickets') && cleanSql.includes('statut = COALESCE')) {
          const statut = params[0];
          const reponse_garage = params[1];
          const id = parseInt(params[2]);
          const t = store.sav_tickets.find(ticket => ticket.id === id);
          if (t) {
            if (statut) t.statut = statut;
            if (reponse_garage !== undefined) t.reponse_garage = reponse_garage;
            saveDb();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        // Update Services prix
        if (cleanSql.includes('UPDATE services SET prix_indicatif = ? WHERE titre = ?')) {
          const prix = parseFloat(params[0]);
          const titre = params[1];
          const s = store.services.find(srv => srv.titre === titre);
          if (s) {
            s.prix_indicatif = prix;
            saveDb();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        return { changes: 0 };
      }
    };
  }
};

module.exports = db;
