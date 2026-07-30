// ===================================================================
// CATALOGUE FOODTRUCKS — liste des foodtrucks habituels du club, pour
// choisir dans une liste déroulante plutôt que ressaisir le nom à
// chaque passage (voir Foodtrucks.gs pour le suivi des passages eux-
// mêmes). Feuille "FoodtrucksCatalog". Réservé Admin/Coach/Salarié.
// ===================================================================

function setupFoodtrucksCatalog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("FoodtrucksCatalog");
  if (!sheet) sheet = ss.insertSheet("FoodtrucksCatalog");
  if (sheet.getDataRange().getNumRows() <= 1) {
    sheet.getRange(1, 1, 1, 2).setValues([["Nom", "PrixDefaut"]]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

// ===================== ACTION API =====================

function api_addFoodtruckCatalog(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageFoodtrucks(role)) return jsonOut({ ok: false, error: "forbidden" });
  const nom = (e.parameter.nom || "").trim();
  if (!nom) return jsonOut({ ok: false, error: "nom_requis" });
  const sheet = ss.getSheetByName("FoodtrucksCatalog");
  const data = sheet.getDataRange().getValues();
  if (data.slice(1).some(r => String(r[0]).trim().toLowerCase() === nom.toLowerCase())) {
    return jsonOut({ ok: false, error: "deja_present" });
  }
  sheet.appendRow([nom, e.parameter.prixDefaut || ""]);
  return jsonOut({ ok: true });
}

function api_deleteFoodtruckCatalog(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageFoodtrucks(role)) return jsonOut({ ok: false, error: "forbidden" });
  const nom = e.parameter.nom || "";
  const sheet = ss.getSheetByName("FoodtrucksCatalog");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === nom) sheet.deleteRow(i + 1);
  }
  return jsonOut({ ok: true });
}
