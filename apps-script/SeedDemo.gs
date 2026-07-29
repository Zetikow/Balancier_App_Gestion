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

// Rosters fictifs partagés entre les sous-fonctions seedDemoXxx ci-dessous (comptes, présences,
// caisse noire, compositions, gestion des matchs...) pour que toutes les pages utilisent le même
// effectif complet plutôt que des sous-listes partielles.
const DEMO_U17_ROSTER = ["Adrien (fictif)","Bastien (fictif)","Clément (fictif)","Dylan (fictif)","Étienne (fictif)","Florian (fictif)","Guillaume (fictif)","Hadrien (fictif)","Igor (fictif)","Jules (fictif)","Kylian (fictif)","Lucas (fictif)","Mathis (fictif)","Nathan (fictif)","Olivier (fictif)","Pierre (fictif)","Raphaël (fictif)","Sacha (fictif)","Thibault (fictif)","Valentin (fictif)"];
const DEMO_U13_ENFANTS = ["Adam (fictif)","Bilal (fictif)","Corentin (fictif)","Diego (fictif)","Eliott (fictif)","Félix (fictif)","Gabin (fictif)","Hippolyte (fictif)","Isaac (fictif)","Jérémy (fictif)","Killian (fictif)","Léandre (fictif)","Mattéo (fictif)","Nino (fictif)","Owen (fictif)","Prosper (fictif)","Ruben (fictif)","Swann (fictif)","Timéo (fictif)","Ulysse (fictif)"];
const DEMO_U13_PARENTS = ["Aurélie (fictif)","Benoît (fictif)","Camille (fictif)","Delphine (fictif)","Emmanuel (fictif)","Fanny (fictif)","Grégory (fictif)","Hélène (fictif)","Isabelle (fictif)","Julien (fictif)","Karine (fictif)","Ludovic (fictif)","Mélanie (fictif)","Nicolas (fictif)","Odile (fictif)","Patrick (fictif)","Sandrine (fictif)","Thomas (fictif)","Valérie (fictif)","Yannick (fictif)"];

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

  const u17 = DEMO_U17_ROSTER;
  const u13Enfants = DEMO_U13_ENFANTS;
  const u13Parents = DEMO_U13_PARENTS;

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
    SM1: PLAYERS,
    U17M1: DEMO_U17_ROSTER,
    U13M1: DEMO_U13_ENFANTS,
  };
  const excuses = ["Blessure", "Raisons professionnelles", "École", "Vacances", "Rendez-vous médical"];

  const rows = [];
  events.forEach(ev => {
    // Les entraînements/matchs trop loin dans le futur n'ont pas encore de réponse — plus réaliste.
    if (!ev.isPast && ev.offset > 10) return;
    const roster = rosterByTeam[ev.equipe] || [];
    roster.forEach((nom, i) => {
      const absent = i % 6 === 5; // un peu de variété (absences ponctuelles)
      const present = absent ? "Non" : "Oui";
      const justif = absent && ev.isPast && i % 2 === 0 ? excuses[i % excuses.length] : "";
      rows.push([ev.id, nom, present, justif]);
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
    [PLAYERS[7], "Oubli de vêtement entraînement", 2],
    [PLAYERS[8], "Retard entraînement", 3],
    [PLAYERS[9], "participation mensuelle", 4],
    [PLAYERS[10], "2min pour avoir râler", 2],
    [PLAYERS[11], "Meilleure action du match", 1],
    [PLAYERS[12], "Retard entraînement", 1],
    [PLAYERS[13], "Oubli de vêtement match", 1],
    [PLAYERS[14], "Taxer de l'eau", 2],
    [PLAYERS[15], "participation mensuelle", 4],
    [PLAYERS[16], "Retard entraînement", 2],
    [PLAYERS[17], "Pire action du match (+ déguisement)", 1],
    [PLAYERS[18], "Oubli de vêtement entraînement", 1],
    [PLAYERS[19], "Nom dans le journal", 1],
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
    const sm1Matches = events.filter(e => e.equipe === "SM1" && e.type === "Match");
    let count = 0;
    sm1Matches.forEach((match, mi) => {
      // Un roulement différent à chaque match pour plus de réalisme (12-14 retenus sur 20).
      const start = (mi * 5) % PLAYERS.length;
      const retenus = [];
      for (let i = 0; i < 13; i++) retenus.push(PLAYERS[(start + i) % PLAYERS.length]);
      retenus.forEach(nom => { selSheet.appendRow([match.id, nom, "Oui"]); count++; });
    });
    if (count) Logger.log(count + " sélection(s) SM1 de démonstration créée(s) sur " + sm1Matches.length + " match(s).");
  }

  const compoSheet = ss.getSheetByName("Compositions");
  const compoMetaSheet = ss.getSheetByName("CompositionsMeta");
  if (compoSheet && compoMetaSheet && compoSheet.getDataRange().getValues().length <= 1) {
    const u17Matches = events.filter(e => e.equipe === "U17M1" && e.type === "Match");
    const zones = ["GB", "AiG", "AiD", "PV", "ArG", "ArD", "DC", "Banc1", "Banc2", "Banc3", "Banc4", "Banc5"];
    let count = 0;
    u17Matches.forEach((match, mi) => {
      const start = (mi * 3) % DEMO_U17_ROSTER.length;
      zones.forEach((zone, i) => {
        const nom = DEMO_U17_ROSTER[(start + i) % DEMO_U17_ROSTER.length];
        compoSheet.appendRow([match.id, nom, zone, "", ""]);
        count++;
      });
      // Seuls les matchs déjà joués (ou le prochain à domicile) sont publiés — un match encore
      // loin dans le futur reste "en préparation" côté coach, plus réaliste.
      if (match.isPast || match.isHome) compoMetaSheet.appendRow([match.id, "1"]);
    });
    if (count) Logger.log(count + " place(s) de composition U17M1 de démonstration créée(s) sur " + u17Matches.length + " match(s).");
  }
}

// ===================== CARTES D'ÉVÉNEMENT (repas/apéro SM1) =====================
function seedDemoCartes(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cartesSheet = ss.getSheetByName("Cartes");
  const reponsesSheet = ss.getSheetByName("CartesReponses");
  if (!cartesSheet || !reponsesSheet) return;
  if (cartesSheet.getDataRange().getValues().length > 1) { Logger.log("Cartes déjà présentes — rien fait."); return; }

  const sm1HomeMatchFuture = events.find(e => e.equipe === "SM1" && e.type === "Match" && !e.isPast && e.isHome);
  const sm1HomeMatchPast = events.find(e => e.equipe === "SM1" && e.type === "Match" && e.isPast && e.isHome);
  let cartes = 0;

  if (sm1HomeMatchFuture) {
    const repasId = Utilities.getUuid();
    cartesSheet.appendRow([repasId, sm1HomeMatchFuture.id, "repas", "Repas d'après match", JSON.stringify(["Restaurant Le Jura", "Pizzeria du Balancier", "Auberge du Lac"]), "180"]);
    reponsesSheet.appendRow([repasId, PLAYERS[0], "vote", "Restaurant Le Jura"]);
    reponsesSheet.appendRow([repasId, PLAYERS[1], "vote", "Restaurant Le Jura"]);
    reponsesSheet.appendRow([repasId, PLAYERS[2], "vote", "Pizzeria du Balancier"]);
    reponsesSheet.appendRow([repasId, PLAYERS[3], "vote", "Auberge du Lac"]);
    reponsesSheet.appendRow([repasId, PLAYERS[0], "participe", "Oui"]);
    reponsesSheet.appendRow([repasId, PLAYERS[1], "participe", "Oui"]);
    reponsesSheet.appendRow([repasId, PLAYERS[2], "participe", "Oui"]);
    reponsesSheet.appendRow([repasId, PLAYERS[5], "participe", "Non"]);

    const aperoId = Utilities.getUuid();
    cartesSheet.appendRow([aperoId, sm1HomeMatchFuture.id, "apero", "Apéro d'avant match", JSON.stringify(["Coca", "Chips", "Jus d'orange", "Cacahuètes"]), ""]);
    reponsesSheet.appendRow([aperoId, PLAYERS[3], "item:Coca", "Oui"]);
    reponsesSheet.appendRow([aperoId, PLAYERS[3], "item:Chips", "Oui"]);
    reponsesSheet.appendRow([aperoId, PLAYERS[4], "item:Jus d'orange", "Oui"]);
    reponsesSheet.appendRow([aperoId, PLAYERS[6], "item:Cacahuètes", "Oui"]);
    cartes += 2;
  }

  if (sm1HomeMatchPast) {
    const repasPastId = Utilities.getUuid();
    cartesSheet.appendRow([repasPastId, sm1HomeMatchPast.id, "repas", "Repas d'après match", JSON.stringify(["Restaurant Le Jura", "Pizzeria du Balancier"]), "150"]);
    reponsesSheet.appendRow([repasPastId, PLAYERS[7], "vote", "Pizzeria du Balancier"]);
    reponsesSheet.appendRow([repasPastId, PLAYERS[8], "vote", "Restaurant Le Jura"]);
    reponsesSheet.appendRow([repasPastId, PLAYERS[7], "participe", "Oui"]);
    reponsesSheet.appendRow([repasPastId, PLAYERS[8], "participe", "Oui"]);
    reponsesSheet.appendRow([repasPastId, PLAYERS[9], "participe", "Oui"]);
    cartes += 1;
  }

  Logger.log(cartes + " carte(s) d'événement de démonstration créée(s).");
}

// ===================== GESTION DES MATCHS (U17M1/U13M1) =====================
function seedDemoGestionMatchs(events) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gouterSheet = ss.getSheetByName("Gouter");
  const tmSheet = ss.getSheetByName("TableMarque");
  const maillotsSheet = ss.getSheetByName("Maillots");
  const covoitSheet = ss.getSheetByName("Covoiturage");
  const ftSheet = ss.getSheetByName("Foodtrucks");

  // Domicile (U17M1/U13M1 uniquement — le SM1 utilise les Cartes repas/apéro à la place) :
  // goûter, table de marque, maillots et foodtrucks se préparent match par match.
  const homeMatches = events.filter(e => e.equipe !== "SM1" && e.type === "Match" && e.isHome);
  // Extérieur : covoiturage à organiser pour chaque déplacement.
  const awayMatches = events.filter(e => e.equipe !== "SM1" && e.type === "Match" && !e.isHome);

  const foodtrucksNoms = ["Chez Momo — Crêpes", "Le Camion à Frites", "Pizza'Roule"];

  let gouterN = 0, tmN = 0, maillotsN = 0, ftN = 0, covoitN = 0;

  homeMatches.forEach((match, mi) => {
    const roster = match.equipe === "U17M1" ? DEMO_U17_ROSTER : DEMO_U13_PARENTS;
    const a = roster[(mi * 2) % roster.length], b = roster[(mi * 2 + 1) % roster.length], c = roster[(mi * 2 + 2) % roster.length];

    if (gouterSheet && gouterSheet.getDataRange().getValues().length <= 1 + gouterN) {
      gouterSheet.appendRow([match.id, a, "Gâteaux"]);
      gouterSheet.appendRow([match.id, b, "Boissons"]);
      gouterN += 2;
    }
    if (tmSheet && tmSheet.getDataRange().getValues().length <= 1 + tmN) {
      tmSheet.appendRow([match.id, c, "Oui"]);
      tmN += 1;
    }
    if (maillotsSheet && maillotsSheet.getDataRange().getValues().length <= 1 + maillotsN) {
      maillotsSheet.appendRow([match.id, a, "Oui"]);
      maillotsN += 1;
    }
    if (ftSheet && ftSheet.getDataRange().getValues().length <= 1 + ftN) {
      ftSheet.appendRow([Utilities.getUuid(), match.id, foodtrucksNoms[mi % foodtrucksNoms.length], "4€ la part", 65 + mi * 10, "Bien venu, à refaire"]);
      ftN += 1;
    }
  });

  awayMatches.forEach((match, mi) => {
    if (!covoitSheet || covoitSheet.getDataRange().getValues().length > 1 + covoitN) return;
    const roster = match.equipe === "U17M1" ? DEMO_U17_ROSTER : DEMO_U13_PARENTS;
    const conducteur = roster[(mi * 3) % roster.length];
    const passager = roster[(mi * 3 + 1) % roster.length];
    const chercheur = roster[(mi * 3 + 2) % roster.length];
    covoitSheet.appendRow([match.id, conducteur, "Oui", "4", ""]);
    covoitSheet.appendRow([match.id, passager, "Oui", "3", ""]);
    covoitSheet.appendRow([match.id, chercheur, "", "", "Oui"]);
    covoitN += 3;
  });

  Logger.log(`Données Gestion des matchs de démonstration créées (${homeMatches.length} match(s) à domicile, ${awayMatches.length} déplacement(s)).`);
}
