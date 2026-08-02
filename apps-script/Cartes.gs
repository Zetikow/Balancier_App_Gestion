// ===================================================================
// CARTES D'ÉVÉNEMENT — cartes optionnelles attachées à un événement SM1
// (match, entraînement, autre), deux types :
//  - "repas"  : restaurant figé choisi dans le catalogue (voir Restaurants.gs
//    et renderRestaurantsSection) + plat/prix assigné à chaque participant —
//    remplace l'ancien sondage du lieu + répartition à parts égales.
//  - "apero"  : "qui amène quoi", liste de choix extensible
// feuilles "Cartes" (une ligne par carte) et "CartesReponses" (une
// ligne par carte+personne+champ). Voir js/modules/cartes.js.
// ===================================================================

function setupCartes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Cartes");
  if (!sheet) sheet = ss.insertSheet("Cartes");
  if (sheet.getDataRange().getNumRows() <= 1) {
    sheet.getRange(1, 1, 1, 7).setValues([["ID", "EventID", "Type", "Titre", "OptionsJSON", "Total", "Restaurant"]]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  ensureCartesRestaurantColumn(sheet);
  let reponses = ss.getSheetByName("CartesReponses");
  if (!reponses) reponses = ss.insertSheet("CartesReponses");
  if (reponses.getDataRange().getNumRows() <= 1) {
    reponses.getRange(1, 1, 1, 4).setValues([["CarteID", "Nom", "Champ", "Valeur"]]);
    reponses.getRange(1, 1, 1, 4).setFontWeight("bold");
    reponses.setFrozenRows(1);
  }
}

// Ajoute la colonne "Restaurant" (carte "repas" : le resto figé choisi pour cet événement,
// remplace le sondage à plusieurs choix — voir Restaurants.gs) si la feuille existait déjà
// depuis avant cette évolution (migration in-place, sans casser les cartes existantes).
function ensureCartesRestaurantColumn(sheet) {
  const header = sheet.getRange(1, 1, 1, 7).getValues()[0];
  if (header[6] !== "Restaurant") {
    sheet.getRange(1, 7).setValue("Restaurant");
    sheet.getRange(1, 7).setFontWeight("bold");
  }
}

function canManageCartes(role) {
  return hasRole(role, "Coach") || hasRole(role, "Admin");
}

// ===================== ACTION API =====================

// Coach/Admin uniquement : crée une carte sur un événement SM1.
// options = chaîne des choix initiaux séparés par "|" (peut être vide, ex: sondage sans
// proposition de départ pour un apéro).
function api_addCarte(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageCartes(role)) return jsonOut({ ok: false, error: "forbidden" });
  const sheet = ss.getSheetByName("Cartes");
  const id = Utilities.getUuid();
  const options = (e.parameter.options || "").split("|").map(s => s.trim()).filter(Boolean);
  const total = e.parameter.total || "";
  sheet.appendRow([id, e.parameter.eventId, e.parameter.type, e.parameter.titre || "", JSON.stringify(options), total]);
  return jsonOut({ ok: true, id });
}

// Coach/Admin uniquement : supprime une carte et toutes ses réponses.
function api_deleteCarte(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageCartes(role)) return jsonOut({ ok: false, error: "forbidden" });
  const carteId = e.parameter.carteId;
  const sheet = ss.getSheetByName("Cartes");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === carteId) sheet.deleteRow(i + 1);
  }
  const reponses = ss.getSheetByName("CartesReponses");
  const rdata = reponses.getDataRange().getValues();
  for (let i = rdata.length - 1; i >= 1; i--) {
    if (rdata[i][0] === carteId) reponses.deleteRow(i + 1);
  }
  return jsonOut({ ok: true });
}

// Coach/Admin uniquement : met à jour le montant total (carte "repas").
function api_setCarteTotal(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageCartes(role)) return jsonOut({ ok: false, error: "forbidden" });
  const sheet = ss.getSheetByName("Cartes");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === e.parameter.carteId) {
      sheet.getRange(i + 1, 6).setValue(e.parameter.total || "");
      return jsonOut({ ok: true });
    }
  }
  return jsonOut({ ok: false, error: "not_found" });
}

// Coach/Admin uniquement : fige (ou change) le restaurant d'une carte "repas" — voir
// Restaurants.gs pour le catalogue. Remplace l'ancien sondage à plusieurs choix.
function api_setCarteRestaurant(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageCartes(role)) return jsonOut({ ok: false, error: "forbidden" });
  const sheet = ss.getSheetByName("Cartes");
  ensureCartesRestaurantColumn(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === e.parameter.carteId) {
      sheet.getRange(i + 1, 7).setValue(e.parameter.restaurant || "");
      return jsonOut({ ok: true });
    }
  }
  return jsonOut({ ok: false, error: "not_found" });
}

// N'importe quel compte authentifié peut proposer un nouveau choix (lieu de repas ou item
// d'apéro) — ajouté à la liste s'il n'y est pas déjà.
function api_addCarteOption(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role) return jsonOut({ ok: false, error: "auth" });
  const option = (e.parameter.option || "").trim();
  if (!option) return jsonOut({ ok: false, error: "empty" });
  const sheet = ss.getSheetByName("Cartes");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === e.parameter.carteId) {
      let options = [];
      try { options = JSON.parse(data[i][4] || "[]"); } catch (err) { options = []; }
      if (options.indexOf(option) === -1) {
        options.push(option);
        sheet.getRange(i + 1, 5).setValue(JSON.stringify(options));
      }
      return jsonOut({ ok: true });
    }
  }
  return jsonOut({ ok: false, error: "not_found" });
}

// Admin uniquement : retire un choix de la liste (ex: doublon, faute de frappe).
function api_removeCarteOption(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !hasRole(role, "Admin")) return jsonOut({ ok: false, error: "forbidden" });
  const option = e.parameter.option || "";
  const sheet = ss.getSheetByName("Cartes");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === e.parameter.carteId) {
      let options = [];
      try { options = JSON.parse(data[i][4] || "[]"); } catch (err) { options = []; }
      options = options.filter(o => o !== option);
      sheet.getRange(i + 1, 5).setValue(JSON.stringify(options));
      return jsonOut({ ok: true });
    }
  }
  return jsonOut({ ok: false, error: "not_found" });
}

// Soi-même, l'Admin, ou un Parent déclaré pour cette personne peuvent répondre (vote, choix
// d'apéro, ou participation au repas) — champ = "vote" | "choix" | "participe" | "plat".
// Champ "plat" (quel plat du resto figé pour cette personne, carte "repas") : en plus des cas
// ci-dessus, le Coach/Admin peut aussi le renseigner pour n'importe quel participant — c'est lui
// qui note les commandes prises sur place, pas forcément chaque joueuse individuellement.
function api_setCarteReponse(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role) return jsonOut({ ok: false, error: "auth" });
  const nom = e.parameter.nom;
  const champ = e.parameter.champ;
  let autorise = hasRole(role, "Admin") || e.parameter.authNom === nom || (champ === "plat" && canManageCartes(role));
  if (!autorise) {
    const details = getSessionRoleDetails(ss, e.parameter.authNom, e.parameter.authCode);
    autorise = !!details && details.some(d => d.role === "Parent" && d.equipe === nom);
  }
  if (!autorise) return jsonOut({ ok: false, error: "forbidden" });

  const sheet = ss.getSheetByName("CartesReponses");
  const carteId = e.parameter.carteId;
  const valeur = e.parameter.valeur || "";
  const data = sheet.getDataRange().getValues();
  if (!valeur) {
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === carteId && data[i][1] === nom && data[i][2] === champ) sheet.deleteRow(i + 1);
    }
    return jsonOut({ ok: true });
  }
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === carteId && data[i][1] === nom && data[i][2] === champ) {
      sheet.getRange(i + 1, 4).setValue(valeur);
      return jsonOut({ ok: true });
    }
  }
  sheet.appendRow([carteId, nom, champ, valeur]);
  return jsonOut({ ok: true });
}
