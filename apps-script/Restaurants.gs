// ===================================================================
// RESTAURANTS — catalogue des restaurants habituels du club et de
// leurs menus (plat + prix), utilisé par la carte "Repas" (Cartes.gs /
// js/modules/cartes.js) pour figer UN resto par événement et noter le
// plat (et son prix) de chaque joueuse présente, plutôt qu'un sondage
// à plusieurs choix + répartition à parts égales.
// Feuilles "Restaurants" (une ligne par resto) et "RestaurantsMenus"
// (une ligne par plat). Onglet dédié dans Gestion des matchs, réservé
// à l'Admin pour la gestion du catalogue (voir canManageRestaurants).
// Porté depuis ASHS.
// ===================================================================

function setupRestaurants() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Restaurants");
  if (!sheet) sheet = ss.insertSheet("Restaurants");
  if (sheet.getDataRange().getNumRows() <= 1) {
    sheet.getRange(1, 1, 1, 1).setValues([["Nom"]]);
    sheet.getRange(1, 1, 1, 1).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  let menus = ss.getSheetByName("RestaurantsMenus");
  if (!menus) menus = ss.insertSheet("RestaurantsMenus");
  if (menus.getDataRange().getNumRows() <= 1) {
    menus.getRange(1, 1, 1, 4).setValues([["ID", "Restaurant", "Plat", "Prix"]]);
    menus.getRange(1, 1, 1, 4).setFontWeight("bold");
    menus.setFrozenRows(1);
  }
}

function canManageRestaurants(role) {
  return hasRole(role, "Admin");
}

// ===================== ACTION API =====================

function api_addRestaurant(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageRestaurants(role)) return jsonOut({ ok: false, error: "forbidden" });
  const nom = (e.parameter.nom || "").trim();
  if (!nom) return jsonOut({ ok: false, error: "nom_requis" });
  const sheet = ss.getSheetByName("Restaurants");
  const data = sheet.getDataRange().getValues();
  if (data.slice(1).some(r => String(r[0]).trim().toLowerCase() === nom.toLowerCase())) {
    return jsonOut({ ok: false, error: "deja_present" });
  }
  sheet.appendRow([nom]);
  return jsonOut({ ok: true });
}

// Admin uniquement : supprime un restaurant et tous les plats de son menu.
function api_deleteRestaurant(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageRestaurants(role)) return jsonOut({ ok: false, error: "forbidden" });
  const nom = e.parameter.nom || "";
  const sheet = ss.getSheetByName("Restaurants");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === nom) sheet.deleteRow(i + 1);
  }
  const menus = ss.getSheetByName("RestaurantsMenus");
  const mdata = menus.getDataRange().getValues();
  for (let i = mdata.length - 1; i >= 1; i--) {
    if (mdata[i][1] === nom) menus.deleteRow(i + 1);
  }
  return jsonOut({ ok: true });
}

function api_addRestaurantMenuItem(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageRestaurants(role)) return jsonOut({ ok: false, error: "forbidden" });
  const restaurant = (e.parameter.restaurant || "").trim();
  const plat = (e.parameter.plat || "").trim();
  if (!restaurant || !plat) return jsonOut({ ok: false, error: "champs_requis" });
  const id = Utilities.getUuid();
  const menus = ss.getSheetByName("RestaurantsMenus");
  menus.appendRow([id, restaurant, plat, e.parameter.prix || ""]);
  return jsonOut({ ok: true, id });
}

function api_deleteRestaurantMenuItem(ss, e) {
  const role = checkAuth(ss, e.parameter.authNom, e.parameter.authCode);
  if (!role || !canManageRestaurants(role)) return jsonOut({ ok: false, error: "forbidden" });
  const id = e.parameter.id || "";
  const menus = ss.getSheetByName("RestaurantsMenus");
  const data = menus.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === id) menus.deleteRow(i + 1);
  }
  return jsonOut({ ok: true });
}
