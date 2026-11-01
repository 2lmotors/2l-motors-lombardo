const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Activation des clés étrangères et mode WAL pour de bonnes performances
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  // Table Utilisateurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      telephone TEXT,
      adresse TEXT,
      role TEXT DEFAULT 'client', -- 'client' ou 'admin'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Table Véhicules des clients
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      immatriculation TEXT NOT NULL,
      marque TEXT NOT NULL,
      modele TEXT NOT NULL,
      annee INTEGER,
      motorisation TEXT,
      kilometrage INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Table Services & Tarifs prédéfinis
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categorie TEXT NOT NULL,
      titre TEXT NOT NULL,
      description TEXT,
      prix_indicatif REAL,
      duree_estimee TEXT,
      inclus TEXT
    );
  `);

  // Table Devis de réparation
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      vehicle_id INTEGER,
      service_id INTEGER,
      immatriculation TEXT,
      description_panne TEXT NOT NULL,
      urgence TEXT DEFAULT 'normale', -- 'basse', 'normale', 'urgente'
      statut TEXT DEFAULT 'en_attente', -- 'en_attente', 'chiffre', 'accepte', 'refuse', 'termine'
      montant_estime REAL,
      commentaires_garage TEXT,
      date_souhaitee TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
    );
  `);

  // Table SAV (Service Après Vente & Réclamations/Suivi)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sav_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quote_id INTEGER,
      titre TEXT NOT NULL,
      description TEXT NOT NULL,
      statut TEXT DEFAULT 'ouvert', -- 'ouvert', 'en_cours', 'resolu', 'ferme'
      priorite TEXT DEFAULT 'normale',
      reponse_garage TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL
    );
  `);

  // Insérer des services et forfaits de base si la table est vide
  const countServices = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  if (countServices === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (categorie, titre, description, prix_indicatif, duree_estimee, inclus)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const initialServices = [
      ['Entretien Courant', 'Vidange & Filtre à huile', 'Huile moteur synthétique certifiée constructeur + remplacement du filtre à huile + 30 points de contrôle.', 160.00, '45 min', 'Huile homologuée, filtre, remise à zéro témoin vidange'],
      ['Entretien Courant', 'Révision Complète Constructeur', 'Vidange, filtre à huile, filtre à air, filtre d’habitacle, contrôle freinage, batterie et niveaux.', 240.00, '1h30', '4 filtres selon modèle, diagnostic électronique, garantie constructeur préservée'],
      ['Freinage', 'Plaquettes de frein avant', 'Contrôle des disques et remplacement des plaquettes avant de qualité origine.', 119.00, '1h', 'Plaquettes qualité première monte, dépoussiérage, contrôle liquide de frein'],
      ['Freinage', 'Disques + Plaquettes avant', 'Remplacement complet du train avant de freinage pour une sécurité optimale.', 249.00, '1h30', 'Disques ventilés/pleins, plaquettes, purge éventuelle'],
      ['Climatisation', 'Entretien & Recharge Climatisation', 'Tirage au vide, test d’étanchéité et recharge en fluide frigorigène R134a ou R1234yf.', 120.00, '45 min', 'Recharge gaz, traitement antibactérien de l’habitacle'],
      ['Moteur & Distribution', 'Kit de Distribution + Pompe à eau', 'Remplacement préventif courroie, galets tendeurs, pompe à eau et nouveau liquide de refroidissement.', 490.00, '4h', 'Courroie, galets, pompe, liquide de refroidissement neuf, garantie 1 an'],
      ['Diagnostic', 'Diagnostic Électronique Valise', 'Passage à la valise multimarque dernière génération, lecture et effacement des codes défauts.', 49.00, '30 min', 'Rapport de diagnostic imprimé ou envoyé par email'],
      ['Pneumatiques', 'Montage & Équilibrage (par pneu)', 'Démontage de l’ancien pneu, valve neuve, montage, équilibrage dynamique.', 20.00, '20 min', 'Valve neuve, équilibrage au gramme près, recyclage pneu usagé'],
      ['Châssis & Liaison au sol', 'Géométrie & Parallélisme', 'Réglage des trains avant et arrière au banc laser pour préserver les pneus et la trajectoire.', 100.00, '45 min', 'Rapport avant/après réglages laser']
    ];

    const insertMany = db.transaction((services) => {
      for (const s of services) insertService.run(s[0], s[1], s[2], s[3], s[4], s[5]);
    });
    insertMany(initialServices);
  }

  // Créer ou mettre à jour le compte administrateur du garage
  const adminEmail = 'ticino1996@hotmail.com';
  const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
  if (!adminExists) {
    const adminPass = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (email, password_hash, nom, prenom, telephone, adresse, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(adminEmail, adminPass, 'LOMBARDO', 'Mario', '+41 76 346 65 01', 'Chemin de la Biole 10, 1860 Aigle', 'admin');
  }
}

initDb();

module.exports = db;

