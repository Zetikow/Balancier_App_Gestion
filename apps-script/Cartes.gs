// ===================================================================
// CARTES D'ÉVÉNEMENT — cartes optionnelles attachées à un événement SM1
// (match, entraînement, autre), deux types :
//  - "repas"  : sondage du lieu + répartition de l'addition par participant
//  - "apero"  : "qui amène quoi", liste de choix extensible
// feuilles "Cartes" (une ligne par carte) et "CartesReponses" (une
// ligne par carte+personne+champ). Voir js/modules/cartes.js.
// ===================================================================

function setupCartes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Cartes");
  if (!sheet) sheet = ss.insertSheet("Cartes");
  if (sheet.getDataRange().getNumRows() <= 1) {
    sheet.getRange(1, 1, 1, 6).setValues([["ID", "EventID", "Type", "Titre", "OptionsJSON", "Total"]]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  let reponses = ss.getSheetByName("CartesReponses");
  if (!reponses) reponses = ss.insertSheet("CartesReponses");
  if (reponses.getDataRange().getNumRows() <= 1) {
    reponses.getRange(1, 1, 1, 4).setValues([["CarteID", "Nom", "Champ", "Valeur"]]);
    reponses.getRange(1, 1, 1, 4).setFontWeight("bold");
    reponses.setFrozenRows(1);
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
// d'apéro, ou participation au repas) — champ = "vote" | "choix" | "participe".
function api_setCarteReponse(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role) return jsonOut({ ok: false, error: "auth" });
  const nom = e.parameter.nom;
  let autorise = hasRole(role, "Admin") || e.parameter.authNom === nom;
  if (!autorise) {
    const details = getSessionRoleDetails(ss, e.parameter.authNom, e.parameter.authCode);
    autorise = !!details && details.some(d => d.role === "Parent" && d.equipe === nom);
  }
  if (!autorise) return jsonOut({ ok: false, error: "forbidden" });

  const sheet = ss.getSheetByName("CartesReponses");
  const carteId = e.parameter.carteId;
  const champ = e.parameter.champ;
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
