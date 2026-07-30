// ===================================================================
// FOODTRUCKS — suivi des passages de foodtrucks lors des matchs à
// domicile : une ligne par passage, feuille "Foodtrucks". Réservé
// Admin/Coach/Salarié (page Gestion des matchs, voir gestion-matchs.js).
// ===================================================================

function setupFoodtrucks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Foodtrucks");
  if (!sheet) sheet = ss.insertSheet("Foodtrucks");
  if (sheet.getDataRange().getNumRows() <= 1) {
    sheet.getRange(1, 1, 1, 7).setValues([["ID", "EventID", "Nom", "Prix", "Benefice", "Notes", "MenuImageUrl"]]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  ensureFoodtrucksMenuImageColumn(sheet);
}

// Ajoute la colonne "MenuImageUrl" (photo du menu, remplace la saisie libre "Prix" — voir
// api_uploadFoodtruckMenuImage) si la feuille existait déjà. Les colonnes "Prix"/"Benefice"
// restent en place pour ne pas perdre l'historique déjà saisi, mais ne sont plus utilisées par
// le formulaire (le club ne prend plus de bénéfice sur les foodtrucks).
function ensureFoodtrucksMenuImageColumn(sheet) {
  const header = sheet.getRange(1, 1, 1, 7).getValues()[0];
  if (header[6] !== "MenuImageUrl") {
    sheet.getRange(1, 7).setValue("MenuImageUrl");
    sheet.getRange(1, 7).setFontWeight("bold");
  }
}

function canManageFoodtrucks(role) {
  return hasRole(role, "Coach") || hasRole(role, "Admin") || hasRole(role, "Salarié");
}

function getFoodtrucksMenusFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("FOODTRUCKS_MENUS_FOLDER_ID");
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (err) { /* dossier supprimé : on en recrée un */ }
  }
  const folder = DriveApp.createFolder("Balancier - Menus foodtrucks");
  props.setProperty("FOODTRUCKS_MENUS_FOLDER_ID", folder.getId());
  return folder;
}

// ===================== ACTION API =====================

function api_addFoodtruck(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageFoodtrucks(role)) return jsonOut({ ok: false, error: "forbidden" });
  const sheet = ss.getSheetByName("Foodtrucks");
  ensureFoodtrucksMenuImageColumn(sheet);
  const id = Utilities.getUuid();
  sheet.appendRow([id, e.parameter.eventId || "", e.parameter.nom || "", "", "", e.parameter.notes || "", e.parameter.menuImageUrl || ""]);
  return jsonOut({ ok: true, id });
}

function api_updateFoodtruck(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageFoodtrucks(role)) return jsonOut({ ok: false, error: "forbidden" });
  const sheet = ss.getSheetByName("Foodtrucks");
  ensureFoodtrucksMenuImageColumn(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === e.parameter.id) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[e.parameter.eventId || "", e.parameter.nom || ""]]);
      sheet.getRange(i + 1, 6).setValue(e.parameter.notes || "");
      if (Object.prototype.hasOwnProperty.call(e.parameter, "menuImageUrl")) {
        sheet.getRange(i + 1, 7).setValue(e.parameter.menuImageUrl || "");
      }
      return jsonOut({ ok: true });
    }
  }
  return jsonOut({ ok: false, error: "not_found" });
}

// Upload de la photo du menu (Coach/Admin/Salarié) — image stockée dans un dossier Drive dédié,
// partagée en lecture pour tous ceux qui ont le lien (comme l'Espace salariés), et affichée via
// un lien direct https://lh3.googleusercontent.com/... (pas un iframe Drive).
function api_uploadFoodtruckMenuImage(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageFoodtrucks(role)) return jsonOut({ ok: false, error: "forbidden" });
  try {
    const folder = getFoodtrucksMenusFolder();
    const bytes = Utilities.base64Decode(e.parameter.base64);
    const blob = Utilities.newBlob(bytes, e.parameter.mimeType || "image/jpeg", e.parameter.filename || "menu.jpg");
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = `https://lh3.googleusercontent.com/d/${file.getId()}=s1600`;
    return jsonOut({ ok: true, url });
  } catch (err) {
    return jsonOut({ ok: false, error: "upload_failed", detail: String(err) });
  }
}

function api_deleteFoodtruck(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageFoodtrucks(role)) return jsonOut({ ok: false, error: "forbidden" });
  const sheet = ss.getSheetByName("Foodtrucks");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === e.parameter.id) sheet.deleteRow(i + 1);
  }
  return jsonOut({ ok: true });
}
