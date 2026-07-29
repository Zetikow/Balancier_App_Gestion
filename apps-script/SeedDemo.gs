// ===================================================================
// DONNÉES DE DÉMONSTRATION — à exécuter UNE FOIS depuis l'éditeur
// (choisir "seedDemoData" dans le menu déroulant, puis Exécuter) APRÈS
// avoir lancé setup() et rempli Grid avec les vrais PLAYERS (setupGrid).
// Toutes les personnes créées sont fictives, marquées "(fictif)".
// Chaque sous-fonction est protégée contre les doublons si relancée
// plusieurs fois par erreur (elle ne fait rien si des données existent déjà).
// ===================================================================

function seedDemoData() {
  const events = seedDemoEvenements();
  seedDemoComptes();
  seedDemoActualites();
  seedDemoPresences(events);
  seedDemoCaisseNoire();
  seedDemoSelectionsAndCompositions(events);
  seedDemoCartes(events);
  seedDemoGestionMatchs(events);
  Logger.log("Données de démonstration créées.");
}

function demoDateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

// ===================== COMPTES =====================
// U13M1 : un compte "Joueur" par enfant (pour le roster/présence) mais qui ne se connecte
// jamais — c'est le compte "Parent" séparé qui sert réellement à se connecter et à répondre
// pour l'enfant (même mécanisme que pour un vrai club, voir myCarpoolIdentitiesForTeam).
function seedDemoComptes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Comptes");
  ensureComptesSchema(sheet);
  const data = sheet.getDataRange().getValues();
  const existants = new Set(data.slice(1).map(r => String(r[COL_NOM]).trim()));

  const u17 = ["Adrien (fictif)","Bastien (fictif)","Clément (fictif)","Dylan (fictif)","Étienne (fictif)","Florian (fictif)","Guillaume (fictif)","Hadrien (fictif)","Igor (fictif)","Jules (fictif)","Kylian (fictif)","Lucas (fictif)","Mathis (fictif)","Nathan (fictif)","Olivier (fictif)","Pierre (fictif)","Raphaël (fictif)","Sacha (fictif)","Thibault (fictif)","Valentin (fictif)"];
  const u13Enfants = ["Adam (fictif)","Bilal (fictif)","Corentin (fictif)","Diego (fictif)","Eliott (fictif)","Félix (fictif)","Gabin (fictif)","Hippolyte (fictif)","Isaac (fictif)","Jérémy (fictif)","Killian (fictif)","Léandre (fictif)","Mattéo (fictif)","Nino (fictif)","Owen (fictif)","Prosper (fictif)","Ruben (fictif)","Swann (fictif)","Timéo (fictif)","Ulysse (fictif)"];
  const u13Parents = ["Aurélie (fictif)","Benoît (fictif)","Camille (fictif)","Delphine (fictif)","Emmanuel (fictif)","Fanny (fictif)","Grégory (fictif)","Hélène (fictif)","Isabelle (fictif)","Julien (fictif)","Karine (fictif)","Ludovic (fictif)","Mélanie (fictif)","Nicolas (fictif)","Odile (fictif)","Patrick (fictif)","Sandrine (fictif)","Thomas (fictif)","Valérie (fictif)","Yannick (fictif)"];

  const rows = [];
  // SM1 : PLAYERS (Config.gs) sont déjà les 20 joueurs SM1 — ajoutés ici aussi par sécurité
  // (idempotent : ignorés s'ils existent déjà via addRealSF1AndU17MRoster-like helpers ailleurs).
  PLAYERS.forEach(nom => rows.push([nom, "Joueur:SM1"]));
  u17.forEach(nom => rows.push([nom, "Joueur:U17M1"]));
  u13Enfants.forEach(nom => rows.push([nom, "Joueur:U13M1"]));
  u13Parents.forEach((nom, i) => rows.push([nom, `Parent:${u13Enfants[i]}`]));
  rows.push(["Coach SM1 (fictif)", "Coach:SM1"]);
  rows.push(["Coach U17M1 (fictif)", "Coach:U17M1"]);
  rows.push(["Coach U13M1 (fictif)", "Coach:U13M1"]);
  rows.push(["Admin (fictif)", "Admin"]);
  rows.push(["Salarié (fictif)", "Salarié"]);

  let ajoutes = 0;
  rows.forEach(([nom, roles]) => {
    if (existants.has(nom)) return;
    const row = new Array(8).fill("");
    row[COL_NOM] = nom;
    row[COL_ROLES] = roles;
    sheet.appendRow(row);
    existants.add(nom);
    ajoutes++;
  });
  Logger.log(ajoutes + " compte(s) de démonstration créé(s). Code à définir par chacun à la première connexion.");
}

// ===================== ÉVÉNEMENTS =====================
function seedDemoEvenements() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Evenements");
  const data = sheet.getDataRange().getValues();
  const already = data.slice(1).some(r => String(r[4] || "").indexOf("Balancier vs") !== -1);
  if (already) {
    Logger.log("Événements de démonstration déjà présents — rien recréé.");
    return data.slice(1).filter(r => r[0]).map(r => ({
      id: r[0], equipe: r[6], type: r[3],
      isPast: new Date(r[1]) < new Date(),
      isHome: String(r[5] || "").toLowerCase().indexOf("balancier") !== -1,
    }));
  }

  const HOME = "Salle du Balancier";
  // équipe, offset (jours par rapport à aujourd'hui), heure, type, adversaire (null = entraînement), lieu, score (null = pas encore joué)
  const plan = [
    ["SM1", -21, "20:30", "Match", "Handball Poligny", "Gymnase de Poligny", "24-28"],
    ["SM1", -14, "20:30", "Match", "ES Lons-le-Saunier", HOME, "31-25"],
    ["SM1", -7, "18:30", "Entraînement", null, HOME, null],
    ["SM1", 3, "18:30", "Entraînement", null, HOME, null],
    ["SM1", 5, "20:30", "Match", "AS Dole", "Salle omnisports de Dole", null],
    ["SM1", 12, "20:30", "Match", "US Salins", HOME, null],

    ["U17M1", -18, "17:00", "Match", "HBC Saint-Claude", HOME, "22-20"],
    ["U17M1", -10, "17:00", "Match", "Pontarlier Handball", "Gymnase de Pontarlier", "18-26"],
    ["U17M1", -4, "18:00", "Entraînement", null, HOME, null],
    ["U17M1", 2, "18:00", "Entraînement", null, HOME, null],
    ["U17M1", 7, "17:00", "Match", "Morez Handball Club", HOME, null],

    ["U13M1", -15, "14:00", "Match", "AS Arbois", HOME, "12-15"],
    ["U13M1", -6, "17:30", "Entraînement", null, HOME, null],
    ["U13M1", 4, "17:30", "Entraînement", null, HOME, null],
    ["U13M1", 9, "14:00", "Match", "Handball Poligny", "Gymnase de Poligny", null],
  ];

  const created = [];
  plan.forEach(([equipe, offset, heure, type, opponent, lieu, score]) => {
    const id = Utilities.getUuid();
    const date = demoDateStr(offset);
    const titre = opponent ? `Balancier vs ${opponent}` : "";
    sheet.appendRow([id, date, heure, type, titre, lieu, equipe, score || ""]);
    created.push({ id, equipe, type, offset, isPast: offset < 0, isHome: lieu === HOME });
  });
  Logger.log(created.length + " événement(s) de démonstration créé(s).");
  return created;
}

// ===================== ACTUALITÉS =====================
function seedDemoActualites() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Actualites");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length > 1) { Logger.log("Actualités déjà présentes — rien fait."); return; }

  const rows = [
    [Utilities.getUuid(), "Bienvenue sur l'application Balancier", "Générale", "Ceci est une application de démonstration : club, équipes, joueurs et données sont fictifs.", "Admin (fictif)", demoDateStr(0)],
    [Utilities.getUuid(), "Reprise des entraînements SM1", "SM1", "L'équipe première reprend l'entraînement cette semaine, présence attendue.", "Coach SM1 (fictif)", demoDateStr(-2)],
    [Utilities.getUuid(), "Nouveau groupe U17M1", "U17M1", "Plusieurs nouveaux joueurs rejoignent le groupe U17M1 cette saison.", "Coach U17M1 (fictif)", demoDateStr(-5)],
    [Utilities.getUuid(), "Tournoi U13M1 le mois prochain", "U13M1", "Un tournoi amical est prévu pour les U13M1, plus d'informations à venir.", "Coach U13M1 (fictif)", demoDateStr(-1)],
  ];
  rows.forEach(r => sheet.appendRow(r));
  Logger.log(rows.length + " actualité(s) de démonstration créée(s).");
}

// ===================== PRÉSENCES =====================
function seedDemoPresences(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PresenceEvenements");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length > 1) { Logger.log("Présences déjà renseignées — rien fait."); return; }

  const rosterByTeam = {
    SM1: PLAYERS.slice(0, 12),
    U17M1: ["Adrien (fictif)","Bastien (fictif)","Clément (fictif)","Dylan (fictif)","Étienne (fictif)","Florian (fictif)","Guillaume (fictif)","Hadrien (fictif)","Igor (fictif)","Jules (fictif)","Kylian (fictif)","Lucas (fictif)"],
    U13M1: ["Adam (fictif)","Bilal (fictif)","Corentin (fictif)","Diego (fictif)","Eliott (fictif)","Félix (fictif)","Gabin (fictif)","Hippolyte (fictif)","Isaac (fictif)","Jérémy (fictif)"],
  };

  const rows = [];
  events.forEach(ev => {
    // Les entraînements/matchs trop loin dans le futur n'ont pas encore de réponse — plus réaliste.
    if (!ev.isPast && ev.offset > 5) return;
    const roster = rosterByTeam[ev.equipe] || [];
    roster.forEach((nom, i) => {
      const present = (i % 6 === 5) ? "Non" : "Oui"; // un peu de variété (absences ponctuelles)
      rows.push([ev.id, nom, present, ""]);
    });
  });
  rows.forEach(r => sheet.appendRow(r));
  Logger.log(rows.length + " présence(s) de démonstration créée(s).");
}

// ===================== CAISSE NOIRE (Grid) =====================
function seedDemoCaisseNoire() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Grid");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) { Logger.log("Grid vide — lance setupGrid() avant seedDemoData()."); return; }

  const header = data[0];
  const playerCol = {};
  header.forEach((h, i) => { if (i >= 2) playerCol[h] = i; });
  const actionRow = {};
  data.forEach((row, i) => { if (i >= 1) actionRow[row[0]] = i; });

  const demoEntries = [
    [PLAYERS[0], "Retard entraînement", 2],
    [PLAYERS[1], "Oubli de vêtement entraînement", 1],
    [PLAYERS[2], "Carton Rouge direct", 1],
    [PLAYERS[3], "participation mensuelle", 4],
    [PLAYERS[4], "Meilleure action du match", 3],
    [PLAYERS[5], "Retard entraînement", 1],
    [PLAYERS[6], "Taxer de l'eau", 5],
  ];
  let ecrites = 0;
  demoEntries.forEach(([nom, action, val]) => {
    const r = actionRow[action], c = playerCol[nom];
    if (r === undefined || c === undefined) return;
    sheet.getRange(r + 1, c + 1).setValue(val);
    ecrites++;
  });
  Logger.log(ecrites + " cellule(s) de caisse noire de démonstration remplie(s).");
}

// ===================== SÉLECTION SM1 + COMPOSITION U17M1 (brûlage) =====================
function seedDemoSelectionsAndCompositions(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const selSheet = ss.getSheetByName("Selections");
  if (selSheet && selSheet.getDataRange().getValues().length <= 1) {
    const sm1Match = events.find(e => e.equipe === "SM1" && e.type === "Match" && e.isPast);
    if (sm1Match) {
      PLAYERS.slice(0, 12).forEach(nom => selSheet.appendRow([sm1Match.id, nom, "Oui"]));
      Logger.log("Sélection SM1 de démonstration créée.");
    }
  }

  const compoSheet = ss.getSheetByName("Compositions");
  const compoMetaSheet = ss.getSheetByName("CompositionsMeta");
  if (compoSheet && compoMetaSheet && compoSheet.getDataRange().getValues().length <= 1) {
    const u17Match = events.find(e => e.equipe === "U17M1" && e.type === "Match" && e.isPast);
    if (u17Match) {
      const slots = [
        ["GB", "Adrien (fictif)"], ["AiG", "Bastien (fictif)"], ["AiD", "Clément (fictif)"],
        ["PV", "Dylan (fictif)"], ["ArG", "Étienne (fictif)"], ["ArD", "Florian (fictif)"], ["DC", "Guillaume (fictif)"],
        ["Banc1", "Hadrien (fictif)"], ["Banc2", "Igor (fictif)"], ["Banc3", "Jules (fictif)"], ["Banc4", "Kylian (fictif)"], ["Banc5", "Lucas (fictif)"],
      ];
      slots.forEach(([zone, nom]) => compoSheet.appendRow([u17Match.id, nom, zone, "", ""]));
      compoMetaSheet.appendRow([u17Match.id, "1"]);
      Logger.log("Composition U17M1 de démonstration créée et publiée.");
    }
  }
}

// ===================== CARTES D'ÉVÉNEMENT (repas/apéro SM1) =====================
function seedDemoCartes(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cartesSheet = ss.getSheetByName("Cartes");
  const reponsesSheet = ss.getSheetByName("CartesReponses");
  if (!cartesSheet || !reponsesSheet) return;
  if (cartesSheet.getDataRange().getValues().length > 1) { Logger.log("Cartes déjà présentes — rien fait."); return; }

  const sm1HomeMatch = events.find(e => e.equipe === "SM1" && e.type === "Match" && !e.isPast && e.isHome);
  if (!sm1HomeMatch) return;

  const repasId = Utilities.getUuid();
  cartesSheet.appendRow([repasId, sm1HomeMatch.id, "repas", "Repas d'après match", JSON.stringify(["Restaurant Le Jura", "Pizzeria du Balancier"]), "180"]);
  reponsesSheet.appendRow([repasId, PLAYERS[0], "vote", "Restaurant Le Jura"]);
  reponsesSheet.appendRow([repasId, PLAYERS[1], "vote", "Restaurant Le Jura"]);
  reponsesSheet.appendRow([repasId, PLAYERS[2], "participe", "Oui"]);

  const aperoId = Utilities.getUuid();
  cartesSheet.appendRow([aperoId, sm1HomeMatch.id, "apero", "Apéro d'avant match", JSON.stringify(["Coca", "Chips", "Jus d'orange"]), ""]);
  reponsesSheet.appendRow([aperoId, PLAYERS[3], "item:Coca", "Oui"]);
  reponsesSheet.appendRow([aperoId, PLAYERS[3], "item:Chips", "Oui"]);
  reponsesSheet.appendRow([aperoId, PLAYERS[4], "item:Jus d'orange", "Oui"]);

  Logger.log("Cartes d'événement de démonstration créées.");
}

// ===================== GESTION DES MATCHS (U17M1/U13M1) =====================
function seedDemoGestionMatchs(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gouterSheet = ss.getSheetByName("Gouter");
  const tmSheet = ss.getSheetByName("TableMarque");
  const maillotsSheet = ss.getSheetByName("Maillots");
  const covoitSheet = ss.getSheetByName("Covoiturage");
  const ftSheet = ss.getSheetByName("Foodtrucks");

  const u17Home = events.find(e => e.equipe === "U17M1" && e.type === "Match" && !e.isPast && e.isHome);
  const u13Away = events.find(e => e.equipe === "U13M1" && e.type === "Match" && !e.isPast && !e.isHome);
  const anyHomeMatch = events.find(e => e.equipe !== "SM1" && e.type === "Match" && e.isHome);

  if (gouterSheet && u17Home && gouterSheet.getDataRange().getValues().length <= 1) {
    gouterSheet.appendRow([u17Home.id, "Adrien (fictif)", "Gâteaux"]);
    gouterSheet.appendRow([u17Home.id, "Bastien (fictif)", "Boissons"]);
  }
  if (tmSheet && u17Home && tmSheet.getDataRange().getValues().length <= 1) {
    tmSheet.appendRow([u17Home.id, "Clément (fictif)", "Oui"]);
  }
  if (maillotsSheet && u17Home && maillotsSheet.getDataRange().getValues().length <= 1) {
    maillotsSheet.appendRow([u17Home.id, "Dylan (fictif)", "Oui"]);
  }
  if (covoitSheet && u13Away && covoitSheet.getDataRange().getValues().length <= 1) {
    covoitSheet.appendRow([u13Away.id, "Aurélie (fictif)", "Oui", "4", ""]);
    covoitSheet.appendRow([u13Away.id, "Benoît (fictif)", "", "", "Oui"]);
  }
  if (ftSheet && anyHomeMatch && ftSheet.getDataRange().getValues().length <= 1) {
    ftSheet.appendRow([Utilities.getUuid(), anyHomeMatch.id, "Chez Momo — Crêpes", "4€ la crêpe", "65", "Bien venu, à refaire"]);
  }
  Logger.log("Données Gestion des matchs de démonstration créées.");
}
