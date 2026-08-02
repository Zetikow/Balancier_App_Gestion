// ===================================================================
// CARTES D'ÉVÉNEMENT — cartes optionnelles attachées à un événement SM1
// (voir renderEventCard dans agenda.js) : "repas" (restaurant figé choisi
// dans le catalogue + plat/prix par participant, voir Restaurants.gs et
// renderRestaurantsSection ci-dessous) ou "apero" ("qui amène quoi",
// liste de choix extensible). Ajout/suppression réservés à Coach/Admin ;
// réponses ouvertes à tous (soi-même ou son enfant, comme covoiturage).
// Porté depuis ASHS (le "repas" remplace l'ancien sondage du lieu +
// répartition à parts égales par un restaurant figé + plats assignés).
// ===================================================================

function cartesForEvent(eventId) {
  return cartes.filter(c => c[1] === eventId);
}
function carteOptions(carte) {
  try { return JSON.parse(carte[4] || "[]"); } catch (err) { return []; }
}
function carteReponsesFor(carteId, champ) {
  return cartesReponses.filter(r => r[0] === carteId && r[2] === champ);
}
function carteReponseFor(carteId, nom, champ) {
  return cartesReponses.find(r => r[0] === carteId && r[1] === nom && r[2] === champ) || null;
}

// Ligne compacte affichée par défaut (window.__carteExpanded[id] indique le dépli) — évite que
// l'événement devienne trop grand quand plusieurs cartes s'accumulent dessous.
function renderCarteCollapsed(id, icon, titre, summary) {
  return `<div class="carte-box carte-collapsed" data-toggle-carte="${escapeHtml(id)}">
    <span class="carte-icon">${icon}</span>
    <div class="carte-collapsed-text"><div class="carte-title">${escapeHtml(titre)}</div><div class="carte-summary">${escapeHtml(summary)}</div></div>
    <span class="carte-chevron">▾</span>
  </div>`;
}

function carteHeadHtml(id, icon, titre, canManage) {
  return `<div class="carte-head" data-toggle-carte="${escapeHtml(id)}">
    <span class="carte-icon">${icon}</span>
    <span class="carte-title">${escapeHtml(titre)}</span>
    <span class="carte-chevron">▴</span>
    ${canManage ? `<span class="carte-del" data-delete-carte="${escapeHtml(id)}">✕</span>` : ""}
  </div>`;
}

async function addCarteApi(eventId, type, titre, options, total) {
  // Optimiste : ferme le formulaire et affiche la carte tout de suite (id provisoire), sans
  // attendre l'aller-retour serveur — fetchAll() la remplace ensuite par la version serveur.
  const tempId = "temp_" + Date.now();
  cartes.push([tempId, eventId, type, titre, JSON.stringify(options), total || ""]);
  window.__addCarteEventId = null;
  render();
  try {
    const params = new URLSearchParams({ action: "addCarte", eventId, type, titre, options: options.join("|"), total: total || "", authNom: session.nom, authCode: session.code });
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();
    if (data.ok) {
      await fetchAll();
    } else {
      cartes = cartes.filter(c => c[0] !== tempId);
      showToast("Échec de la création de la carte", "error");
      render();
    }
  } catch (err) {
    isOnline = false;
    cartes = cartes.filter(c => c[0] !== tempId);
    showToast("Échec de la création de la carte", "error");
    render();
  }
}

async function deleteCarteApi(carteId) {
  try {
    await fetch(`${GOOGLE_SCRIPT_URL}?action=deleteCarte&carteId=${encodeURIComponent(carteId)}&authNom=${encodeURIComponent(session.nom)}&authCode=${encodeURIComponent(session.code)}`);
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function setCarteTotalApi(carteId, total) {
  const carte = cartes.find(c => c[0] === carteId);
  if (carte) carte[5] = total;
  render();
  try {
    await fetch(`${GOOGLE_SCRIPT_URL}?action=setCarteTotal&carteId=${encodeURIComponent(carteId)}&total=${encodeURIComponent(total)}&authNom=${encodeURIComponent(session.nom)}&authCode=${encodeURIComponent(session.code)}`);
  } catch (err) { isOnline = false; render(); }
}

async function setCarteRestaurantApi(carteId, restaurant) {
  const carte = cartes.find(c => c[0] === carteId);
  if (carte) carte[6] = restaurant;
  render();
  try {
    const params = new URLSearchParams({ action: "setCarteRestaurant", carteId, restaurant, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function addCarteOptionApi(carteId, option) {
  const carte = cartes.find(c => c[0] === carteId);
  if (carte) {
    const opts = carteOptions(carte);
    if (opts.indexOf(option) === -1) { opts.push(option); carte[4] = JSON.stringify(opts); }
  }
  render();
  try {
    await fetch(`${GOOGLE_SCRIPT_URL}?action=addCarteOption&carteId=${encodeURIComponent(carteId)}&option=${encodeURIComponent(option)}&authNom=${encodeURIComponent(session.nom)}&authCode=${encodeURIComponent(session.code)}`);
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function removeCarteOptionApi(carteId, option) {
  if (!confirm(`Retirer "${option}" de la liste ?`)) return;
  const carte = cartes.find(c => c[0] === carteId);
  if (carte) carte[4] = JSON.stringify(carteOptions(carte).filter(o => o !== option));
  render();
  try {
    await fetch(`${GOOGLE_SCRIPT_URL}?action=removeCarteOption&carteId=${encodeURIComponent(carteId)}&option=${encodeURIComponent(option)}&authNom=${encodeURIComponent(session.nom)}&authCode=${encodeURIComponent(session.code)}`);
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function setCarteReponseApi(carteId, nom, champ, valeur) {
  const existing = carteReponseFor(carteId, nom, champ);
  if (valeur) {
    if (existing) existing[3] = valeur; else cartesReponses.push([carteId, nom, champ, valeur]);
  } else if (existing) {
    cartesReponses = cartesReponses.filter(r => r !== existing);
  }
  render();
  try {
    const params = new URLSearchParams({ action: "setCarteReponse", carteId, nom, champ, valeur, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
  } catch (err) { isOnline = false; render(); }
}

// Un resto figé (choisi dans le catalogue, voir Restaurants.gs/gestion-matchs.js) remplace
// l'ancien sondage à plusieurs choix. Une fois le resto choisi, le Coach/Admin assigne un plat
// (avec son prix, tiré du menu du resto) à chaque personne ayant coché "Je participe" — le total
// dû n'est plus une simple division à parts égales mais la somme des plats commandés.
function renderRepasCard(carte, identities, canManage) {
  const [id, , , titre, , , restaurant] = carte;
  const menu = restaurant ? restaurantsMenus.filter(r => r[1] === restaurant) : [];
  const platReponses = carteReponsesFor(id, "plat");
  const platFor = (nom) => {
    const r = platReponses.find(x => x[1] === nom);
    return r ? menu.find(m => m[2] === r[3]) : null;
  };
  const participants = carteReponsesFor(id, "participe").filter(r => r[3] === "Oui").map(r => r[1]);
  const total = participants.reduce((s, nom) => { const item = platFor(nom); return s + (item ? parseFloat(item[3]) || 0 : 0); }, 0);

  const summary = !restaurant
    ? "Restaurant à choisir"
    : `${restaurant}${participants.length ? " · " + total.toFixed(2) + " € · " + participants.length + " participant" + (participants.length > 1 ? "s" : "") : " · Aucune participation pour l'instant"}`;

  const expanded = !!(window.__carteExpanded && window.__carteExpanded[id]);
  if (!expanded) return renderCarteCollapsed(id, "🍽", titre || "Repas d'après match", summary);

  let html = `<div class="carte-box carte-repas">
    ${carteHeadHtml(id, "🍽", titre || "Repas d'après match", canManage)}
    <div class="carte-sub-h">Restaurant</div>`;

  if (canManage) {
    html += `<select data-carte-restaurant="${escapeHtml(id)}">
      <option value="">— Choisir —</option>
      ${restaurants.map(r => `<option value="${escapeHtml(r[0])}" ${restaurant === r[0] ? "selected" : ""}>${escapeHtml(r[0])}</option>`).join("")}
    </select>`;
    if (restaurants.length === 0) html += `<div class="muted" style="font-size:10.5px; margin-top:4px;">Catalogue vide — ajoute un restaurant depuis Gestion des matchs → Restaurants.</div>`;
  } else {
    html += `<div style="font-size:13px; color:#e8e8ee; font-weight:700;">${restaurant ? escapeHtml(restaurant) : "Pas encore choisi"}</div>`;
  }

  if (restaurant) {
    html += `<div class="carte-split-line">
      <span class="lbl">Total dû (${participants.length} participant${participants.length > 1 ? "s" : ""})</span>
      <span class="num accent">${total.toFixed(2)} €</span>
    </div>`;
  }

  identities.forEach(idt => {
    const participe = carteReponseFor(id, idt.nom, "participe");
    const item = platFor(idt.nom);
    html += `<div class="carte-identity">
      <div class="cp-edit-label">${idt.isChild ? `Pour ${escapeHtml(idt.nom)} <span class="cp-for-child">ton enfant</span>` : "Toi"}</div>
      <button type="button" class="cp-toggle-btn ${participe && participe[3] === "Oui" ? "active-yes" : ""}" style="width:100%;" data-carte-participe="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">Je participe</button>
      ${item ? `<div class="muted" style="font-size:11px; margin-top:4px;">Plat prévu : ${escapeHtml(item[2])} · ${escapeHtml(String(item[3]))} €</div>` : ""}
    </div>`;
  });

  if (canManage && restaurant) {
    html += `<div class="carte-sub-h" style="margin-top:10px;">Plats (${participants.length} présent${participants.length > 1 ? "s" : ""})</div>`;
    if (participants.length === 0) {
      html += `<div class="cp-empty">Personne n'a encore coché "Je participe".</div>`;
    } else if (menu.length === 0) {
      html += `<div class="muted" style="font-size:11px;">Ce restaurant n'a pas encore de menu renseigné (Gestion des matchs → Restaurants).</div>`;
    } else {
      participants.forEach(nom => {
        const platR = platReponses.find(r => r[1] === nom);
        html += `<div class="cp-row" style="flex-direction:column; align-items:stretch; gap:4px; padding:8px 0;">
          <span>${escapeHtml(nom)}</span>
          <select data-carte-plat="${escapeHtml(id)}|||${escapeHtml(nom)}">
            <option value="">— Plat —</option>
            ${menu.map(m => `<option value="${escapeHtml(m[2])}" ${platR && platR[3] === m[2] ? "selected" : ""}>${escapeHtml(m[2])} — ${escapeHtml(String(m[3]))} €</option>`).join("")}
          </select>
        </div>`;
      });
    }
  }

  html += `</div>`;
  return html;
}

// Un même identité peut cocher plusieurs choix (ex: Coca ET chips) — une réponse par item,
// champ = "item:<nom de l'option>", valeur = "Oui"/"" (voir aperoItemChamp).
function aperoItemChamp(option) {
  return "item:" + option;
}
function aperoSignupsFor(carteId) {
  return cartesReponses.filter(r => r[0] === carteId && r[2].indexOf("item:") === 0 && r[3] === "Oui")
    .map(r => ({ nom: r[1], item: r[2].slice(5) }));
}

function renderAperoCard(carte, identities, canManage) {
  const [id, , , titre] = carte;
  const options = carteOptions(carte);
  const signups = aperoSignupsFor(id);

  const summary = signups.length > 0 ? `${signups.length} inscription${signups.length > 1 ? "s" : ""}` : "Aucune inscription pour l'instant";
  const expanded = !!(window.__carteExpanded && window.__carteExpanded[id]);
  if (!expanded) return renderCarteCollapsed(id, "🥂", titre || "Qui amène quoi", summary);

  let html = `<div class="carte-box carte-apero">
    ${carteHeadHtml(id, "🥂", titre || "Qui amène quoi", canManage)}
    <div class="carte-sub-h">Qui amène quoi</div>`;

  if (signups.length === 0) {
    html += `<div class="cp-empty">Personne pour l'instant</div>`;
  } else {
    signups.forEach(s => { html += `<div class="cp-row"><span>${escapeHtml(s.nom)}</span><span class="places">${escapeHtml(s.item)}</span></div>`; });
  }

  identities.forEach(idt => {
    html += `<div class="carte-identity">
      <div class="cp-edit-label">${idt.isChild ? `Pour ${escapeHtml(idt.nom)} <span class="cp-for-child">ton enfant</span>` : "Toi"}</div>
      ${options.map(o => {
        const checked = !!carteReponseFor(id, idt.nom, aperoItemChamp(o));
        return `<label style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:12.5px; color:#e8e8ee;">
          <input type="checkbox" data-carte-item="${escapeHtml(id)}|||${escapeHtml(idt.nom)}|||${escapeHtml(o)}" ${checked ? "checked" : ""} style="width:17px; height:17px; flex-shrink:0;" />
          ${escapeHtml(o)}
        </label>`;
      }).join("")}
      <div class="carte-propose" style="margin-top:6px;"><input type="text" placeholder="Ajouter un nouveau choix..." id="carte-propose-${id}-${idt.nom}" /><button type="button" class="btn secondary" style="width:auto; padding:8px 12px;" data-carte-propose-choix="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">Ajouter</button></div>
      ${canManage && options.length > 0 ? `<div class="muted" style="font-size:9.5px; margin-top:6px;">Retirer un choix : ${options.map(o => `<span class="cp-for-child" style="cursor:pointer;" data-carte-remove-option="${escapeHtml(id)}|||${escapeHtml(o)}">${escapeHtml(o)} ✕</span>`).join(" ")}</div>` : ""}
    </div>`;
  });

  html += `<div class="muted" style="font-size:9.5px; margin-top:8px; text-align:center;">Coche tout ce que tu apportes — un nouveau choix reste dans la liste pour les prochaines fois.</div></div>`;
  return html;
}

function renderAddCarteForm(eventId) {
  const type = window.__addCarteType || "repas";
  return `<div class="add-form">
    <div class="salaries-type-row">
      <button type="button" class="salaries-type-btn ${type === 'repas' ? 'active' : ''}" data-carte-type-pick="${escapeHtml(eventId)}|||repas">🍽 Repas</button>
      <button type="button" class="salaries-type-btn ${type === 'apero' ? 'active' : ''}" data-carte-type-pick="${escapeHtml(eventId)}|||apero">🥂 Qui amène quoi</button>
    </div>
    <label class="field-label">Titre</label>
    <input id="carte-new-titre" type="text" placeholder="${type === 'repas' ? "ex: Repas d'après match" : 'ex: Apéro entre filles'}" />
    ${type === "apero" ? `<label class="field-label">Choix de départ (un par ligne, facultatif)</label>
    <textarea id="carte-new-options" rows="3" placeholder="Chips et gâteaux\nBoissons sans alcool"></textarea>` : `<div class="muted" style="font-size:10.5px; margin-top:4px;">Le restaurant se choisit juste après la création de la carte.</div>`}
    <button class="btn" id="submit-add-carte" style="margin-top:8px;" data-event-id="${escapeHtml(eventId)}" data-carte-type="${type}">Créer la carte</button>
  </div>`;
}

function renderCartesForEvent(ev, canManage) {
  const eventId = ev[0];
  const list = cartesForEvent(eventId);
  const identities = myCarpoolIdentitiesForTeam("SM1");
  let html = "";
  list.forEach(carte => {
    html += carte[2] === "repas" ? renderRepasCard(carte, identities, canManage) : renderAperoCard(carte, identities, canManage);
  });
  if (canManage) {
    const isOpen = window.__addCarteEventId === eventId;
    html += `<div class="carte-toggle" data-toggle-add-carte="${escapeHtml(eventId)}">${isOpen ? "− Fermer" : "+ Ajouter une carte"}</div>`;
    if (isOpen) html += renderAddCarteForm(eventId);
  }
  return html;
}

function attachCartesEvents() {
  document.querySelectorAll("[data-toggle-add-carte]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const eventId = el.dataset.toggleAddCarte;
      window.__addCarteEventId = window.__addCarteEventId === eventId ? null : eventId;
      window.__addCarteType = "repas";
      render();
    };
  });

  document.querySelectorAll("[data-carte-type-pick]").forEach(el => {
    el.onclick = () => {
      const [, type] = el.dataset.carteTypePick.split("|||");
      window.__addCarteType = type;
      render();
    };
  });

  const submitAddCarte = document.getElementById("submit-add-carte");
  if (submitAddCarte) submitAddCarte.onclick = (e) => {
    const eventId = e.currentTarget.dataset.eventId;
    const type = e.currentTarget.dataset.carteType;
    const titre = document.getElementById("carte-new-titre").value.trim();
    const optionsInput = document.getElementById("carte-new-options");
    const options = optionsInput ? optionsInput.value.split("\n").map(s => s.trim()).filter(Boolean) : [];
    addCarteApi(eventId, type, titre, options, "");
  };

  document.querySelectorAll("[data-delete-carte]").forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      if (confirm("Supprimer cette carte ?")) deleteCarteApi(el.dataset.deleteCarte);
    };
  });

  document.querySelectorAll("[data-toggle-carte]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const id = el.dataset.toggleCarte;
      window.__carteExpanded = window.__carteExpanded || {};
      window.__carteExpanded[id] = !window.__carteExpanded[id];
      render();
    };
  });

  document.querySelectorAll("[data-carte-restaurant]").forEach(el => {
    el.onchange = () => setCarteRestaurantApi(el.dataset.carteRestaurant, el.value);
  });

  document.querySelectorAll("[data-carte-plat]").forEach(el => {
    el.onchange = () => {
      const [carteId, nom] = el.dataset.cartePlat.split("|||");
      setCarteReponseApi(carteId, nom, "plat", el.value);
    };
  });

  document.querySelectorAll("[data-carte-propose-choix]").forEach(el => {
    el.onclick = () => {
      const [carteId, nom] = el.dataset.carteProposeChoix.split("|||");
      const input = document.getElementById(`carte-propose-${carteId}-${nom}`);
      const val = input ? input.value.trim() : "";
      if (val) {
        addCarteOptionApi(carteId, val).then(() => setCarteReponseApi(carteId, nom, aperoItemChamp(val), "Oui"));
      }
    };
  });

  document.querySelectorAll("[data-carte-remove-option]").forEach(el => {
    el.onclick = () => {
      const [carteId, option] = el.dataset.carteRemoveOption.split("|||");
      removeCarteOptionApi(carteId, option);
    };
  });

  document.querySelectorAll("[data-carte-participe]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const [carteId, nom] = el.dataset.carteParticipe.split("|||");
      const current = carteReponseFor(carteId, nom, "participe");
      setCarteReponseApi(carteId, nom, "participe", current && current[3] === "Oui" ? "" : "Oui");
    };
  });

  document.querySelectorAll("[data-carte-item]").forEach(el => {
    el.onchange = () => {
      vibrate();
      const [carteId, nom, option] = el.dataset.carteItem.split("|||");
      setCarteReponseApi(carteId, nom, aperoItemChamp(option), el.checked ? "Oui" : "");
    };
  });
}

// ===================== CATALOGUE RESTAURANTS (onglet Gestion des matchs, Admin) =====================

async function addRestaurantApi(nom) {
  const already = restaurants.some(r => r[0] === nom);
  if (!already) { restaurants.push([nom]); render(); }
  try {
    const params = new URLSearchParams({ action: "addRestaurant", nom, authNom: session.nom, authCode: session.code });
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();
    if (data.ok) {
      await fetchAll();
    } else {
      restaurants = restaurants.filter(r => r[0] !== nom);
      showToast(data.error === "deja_present" ? "Ce restaurant est déjà dans le catalogue" : "Échec de l'ajout", "error");
      render();
    }
  } catch (err) {
    isOnline = false;
    restaurants = restaurants.filter(r => r[0] !== nom);
    showToast("Échec de l'ajout", "error");
    render();
  }
}

async function deleteRestaurantApi(nom) {
  if (!confirm(`Supprimer "${nom}" et tout son menu du catalogue ?`)) return;
  const backupRestaurants = restaurants, backupMenus = restaurantsMenus;
  restaurants = restaurants.filter(r => r[0] !== nom);
  restaurantsMenus = restaurantsMenus.filter(m => m[1] !== nom);
  render();
  try {
    const params = new URLSearchParams({ action: "deleteRestaurant", nom, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    await fetchAll();
  } catch (err) {
    isOnline = false;
    restaurants = backupRestaurants;
    restaurantsMenus = backupMenus;
    render();
  }
}

async function addRestaurantMenuItemApi(restaurant, plat, prix) {
  const tempId = "temp_" + Date.now();
  restaurantsMenus.push([tempId, restaurant, plat, prix || ""]);
  render();
  try {
    const params = new URLSearchParams({ action: "addRestaurantMenuItem", restaurant, plat, prix: prix || "", authNom: session.nom, authCode: session.code });
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();
    if (data.ok) {
      await fetchAll();
    } else {
      restaurantsMenus = restaurantsMenus.filter(m => m[0] !== tempId);
      showToast("Échec de l'ajout", "error");
      render();
    }
  } catch (err) {
    isOnline = false;
    restaurantsMenus = restaurantsMenus.filter(m => m[0] !== tempId);
    showToast("Échec de l'ajout", "error");
    render();
  }
}

async function deleteRestaurantMenuItemApi(id) {
  const backup = restaurantsMenus;
  restaurantsMenus = restaurantsMenus.filter(m => m[0] !== id);
  render();
  try {
    const params = new URLSearchParams({ action: "deleteRestaurantMenuItem", id, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    await fetchAll();
  } catch (err) {
    isOnline = false;
    restaurantsMenus = backup;
    render();
  }
}

// Onglet "Restaurants" de Gestion des matchs (voir gestion-matchs.js) : gestion du catalogue
// utilisé par la carte "Repas" ci-dessus (renderRepasCard) — réservé à l'Admin.
function renderRestaurantsSection() {
  let html = `<div class="section-h">Catalogue des restaurants</div>`;

  if (restaurants.length === 0) {
    html += `<div class="card muted">Aucun restaurant enregistré pour l'instant.</div>`;
  }
  restaurants.forEach(([nom]) => {
    const menu = restaurantsMenus.filter(m => m[1] === nom);
    const expanded = !!(window.__restaurantExpanded && window.__restaurantExpanded[nom]);
    html += `<div class="card">
      <div class="carte-head" data-toggle-restaurant="${escapeHtml(nom)}" style="cursor:pointer;">
        <span class="carte-title">${escapeHtml(nom)}</span>
        <span class="muted" style="font-size:10.5px; margin-left:6px;">${menu.length} plat${menu.length > 1 ? "s" : ""}</span>
        <span class="carte-chevron" style="margin-left:auto;">${expanded ? "▴" : "▾"}</span>
        <span class="carte-del" data-delete-restaurant="${escapeHtml(nom)}">✕</span>
      </div>`;
    if (expanded) {
      if (menu.length === 0) {
        html += `<div class="cp-empty">Aucun plat pour l'instant.</div>`;
      } else {
        menu.forEach(([id, , plat, prix]) => {
          html += `<div class="paiement-row">
            <span>${escapeHtml(plat)}</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="muted">${escapeHtml(String(prix || "—"))} €</span>
              ${iconBtn(ICON_CROSS, "ev-del", `data-delete-restaurant-menu-item="${escapeHtml(id)}"`)}
            </div>
          </div>`;
        });
      }
      html += `<div class="add-form" style="margin-top:8px;">
        <label class="field-label">Nouveau plat</label>
        <input id="resto-plat-nom" type="text" placeholder="Ex: Tartiflette" />
        <label class="field-label">Prix (€)</label>
        <input id="resto-plat-prix" type="number" step="0.5" placeholder="Ex: 14" />
        <button class="btn" style="margin-top:6px;" data-add-restaurant-menu-item="${escapeHtml(nom)}">Ajouter au menu</button>
      </div>`;
    }
    html += `</div>`;
  });

  html += `<button class="btn add-btn-primary" id="toggle-add-restaurant">${window.__showAddRestaurant ? "− Fermer" : "+ Ajouter un restaurant"}</button>`;
  if (window.__showAddRestaurant) {
    html += `<div class="add-form">
      <label class="field-label">Nom du restaurant</label>
      <input id="restaurant-new-nom" type="text" placeholder="Ex: La Table du Stade" />
      <button class="btn" id="restaurant-add" style="margin-top:6px;">Ajouter</button>
    </div>`;
  }
  return html;
}

function attachRestaurantsEvents() {
  document.querySelectorAll("[data-toggle-restaurant]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const nom = el.dataset.toggleRestaurant;
      window.__restaurantExpanded = window.__restaurantExpanded || {};
      window.__restaurantExpanded[nom] = !window.__restaurantExpanded[nom];
      render();
    };
  });

  document.querySelectorAll("[data-delete-restaurant]").forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      deleteRestaurantApi(el.dataset.deleteRestaurant);
    };
  });

  document.querySelectorAll("[data-add-restaurant-menu-item]").forEach(el => {
    el.onclick = () => {
      const restaurant = el.dataset.addRestaurantMenuItem;
      const plat = document.getElementById("resto-plat-nom").value.trim();
      const prix = document.getElementById("resto-plat-prix").value.trim();
      if (!plat) return;
      addRestaurantMenuItemApi(restaurant, plat, prix);
    };
  });

  document.querySelectorAll("[data-delete-restaurant-menu-item]").forEach(el => {
    el.onclick = () => deleteRestaurantMenuItemApi(el.dataset.deleteRestaurantMenuItem);
  });

  const toggleAddRestaurant = document.getElementById("toggle-add-restaurant");
  if (toggleAddRestaurant) toggleAddRestaurant.onclick = () => {
    vibrate();
    window.__showAddRestaurant = !window.__showAddRestaurant;
    render();
  };

  const restaurantAdd = document.getElementById("restaurant-add");
  if (restaurantAdd) restaurantAdd.onclick = () => {
    const nom = document.getElementById("restaurant-new-nom").value.trim();
    if (!nom) return;
    window.__showAddRestaurant = false;
    addRestaurantApi(nom);
  };
}
