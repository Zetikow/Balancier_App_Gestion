// ===================================================================
// GESTION DES MATCHS — covoiturage (extérieur), goûter d'après match
// (domicile), disponibilité table de marque (domicile + extérieur),
// suivi des maillots (qui les prend à laver, domicile + extérieur),
// suivi des foodtrucks. Une sous-section à la fois
// (window.__gestionMatchsSection), rendue en grille de chips
// (.gm-section-grid), même sélecteur d'équipe que le reste (feuilles
// Covoiturage/Gouter/TableMarque/Maillots côté backend). Le repas
// d'après-match SM1 se gère désormais via les cartes d'événement
// (voir cartes.js, carte type "repas") — remplace l'ancien système
// RepasMenu/RepasPrevu/RepasTarifs/RepasFinances.
// ===================================================================

const GESTION_MATCHS_SECTIONS = [
  { id: "covoiturage", label: "Covoiturage" },
  { id: "gouter", label: "Goûter" },
  { id: "tablemarque", label: "Table de marque" },
  { id: "maillots", label: "Maillots" },
  { id: "foodtruck", label: "Foodtrucks" },
  { id: "restaurants", label: "Restaurants" },
];

// Catalogue restaurants (carte "Repas" SM1, voir cartes.js) : réservé Admin.
function canManageRestaurants() {
  return hasRole("Admin");
}

// Suivi financier des foodtrucks : réservé Admin/Coach/Salarié, pas un onglet joueur/parent.
function canManageFoodtrucks() {
  return hasRole("Admin") || hasRole("Coach") || hasRole("Salarié");
}

function gestionMatchsSectionsForRole() {
  return GESTION_MATCHS_SECTIONS.filter(s =>
    (s.id !== "foodtruck" || canManageFoodtrucks()) &&
    (s.id !== "restaurants" || canManageRestaurants())
  );
}

const GESTION_MATCHS_USAGE_KEY = "balancier-gestion-matchs-usage";

// Fréquence d'usage par section, propre à cet appareil (localStorage) — pas de notion de
// compte serveur ici, juste une préférence locale qui fait remonter ce que CE téléphone
// utilise le plus, pour réduire le nombre de sections visibles d'un coup sur mobile.
function gestionMatchsUsageCounts() {
  try { return JSON.parse(localStorage.getItem(GESTION_MATCHS_USAGE_KEY) || "{}"); }
  catch (err) { return {}; }
}

function bumpGestionMatchsUsage(id) {
  const counts = gestionMatchsUsageCounts();
  counts[id] = (counts[id] || 0) + 1;
  try { localStorage.setItem(GESTION_MATCHS_USAGE_KEY, JSON.stringify(counts)); } catch (err) {}
}

// Sections triées par usage décroissant (les plus cliquées en premier) — tri stable, donc à
// usage égal (ex: 0 clic, première visite) on garde l'ordre par défaut de GESTION_MATCHS_SECTIONS.
function gestionMatchsSectionsSorted() {
  const counts = gestionMatchsUsageCounts();
  return gestionMatchsSectionsForRole()
    .map((s, i) => ({ s, i, n: counts[s.id] || 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(x => x.s);
}

function covoitEntryFor(eventId, nom) {
  return covoiturage.find(r => r[0] === eventId && r[1] === nom) || null;
}
// Goûter façon "apero" : liste de choix extensible par match (voir gouterOptionsFor), chaque
// personne coche ce qu'elle apporte — une ligne par item coché (gouterSignupsFor), remplace
// l'ancien champ texte libre unique par personne.
function gouterOptionsFor(eventId) {
  const row = gouterOptions.find(r => r[0] === eventId);
  if (!row) return [];
  try { return JSON.parse(row[1] || "[]"); } catch (err) { return []; }
}
function gouterSignupsFor(eventId) {
  return gouter.filter(r => r[0] === eventId);
}
function gouterHasItem(eventId, nom, item) {
  return gouter.some(r => r[0] === eventId && r[1] === nom && r[2] === item);
}
function tableMarqueEntryFor(eventId, nom) {
  return tableMarque.find(r => r[0] === eventId && r[1] === nom) || null;
}
function maillotsEntryFor(eventId, nom) {
  return maillots.find(r => r[0] === eventId && r[1] === nom) || null;
}
// Nombre de fois où cette personne a pris les maillots sur la saison.
function maillotsCountFor(nom) {
  return maillots.filter(r => r[1] === nom && r[2] === "Oui").length;
}

async function setCovoiturageApi(nom, eventId, jeConduit, places, besoinPlace) {
  const existing = covoitEntryFor(eventId, nom);
  if (existing) { existing[2] = jeConduit; existing[3] = places; existing[4] = besoinPlace; }
  else covoiturage.push([eventId, nom, jeConduit, places, besoinPlace]);
  render();
  try {
    const params = new URLSearchParams({ action: "setCovoiturage", nom, eventId, jeConduit, places, besoinPlace, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
  } catch (err) { isOnline = false; render(); }
}

async function setGouterItemApi(nom, eventId, item, checked) {
  const already = gouterHasItem(eventId, nom, item);
  if (checked && !already) gouter.push([eventId, nom, item]);
  else if (!checked && already) gouter = gouter.filter(r => !(r[0] === eventId && r[1] === nom && r[2] === item));
  render();
  try {
    const params = new URLSearchParams({ action: "setGouter", nom, eventId, item, valeur: checked ? "Oui" : "", authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
  } catch (err) { isOnline = false; render(); }
}

async function addGouterOptionApi(eventId, option) {
  const row = gouterOptions.find(r => r[0] === eventId);
  if (row) {
    const opts = gouterOptionsFor(eventId);
    if (opts.indexOf(option) === -1) { opts.push(option); row[1] = JSON.stringify(opts); }
  } else {
    gouterOptions.push([eventId, JSON.stringify([option])]);
  }
  render();
  try {
    const params = new URLSearchParams({ action: "addGouterOption", eventId, option, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function removeGouterOptionApi(eventId, option) {
  if (!confirm(`Retirer "${option}" de la liste ?`)) return;
  const row = gouterOptions.find(r => r[0] === eventId);
  if (row) row[1] = JSON.stringify(gouterOptionsFor(eventId).filter(o => o !== option));
  render();
  try {
    const params = new URLSearchParams({ action: "removeGouterOption", eventId, option, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function setTableMarqueApi(nom, eventId, disponible) {
  const existing = tableMarqueEntryFor(eventId, nom);
  if (disponible) {
    if (existing) existing[2] = disponible; else tableMarque.push([eventId, nom, disponible]);
  } else if (existing) {
    tableMarque = tableMarque.filter(r => r !== existing);
  }
  render();
  try {
    const params = new URLSearchParams({ action: "setTableMarque", nom, eventId, disponible, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
  } catch (err) { isOnline = false; render(); }
}

async function setMaillotsApi(nom, eventId, pris) {
  const existing = maillotsEntryFor(eventId, nom);
  if (pris) {
    if (existing) existing[2] = pris; else maillots.push([eventId, nom, pris]);
  } else if (existing) {
    maillots = maillots.filter(r => r !== existing);
  }
  render();
  try {
    const params = new URLSearchParams({ action: "setMaillots", nom, eventId, pris, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
  } catch (err) { isOnline = false; render(); }
}

function gestionMatchsUpcoming(activeTeam, homeFilter) {
  const now = new Date();
  return evenements.filter(ev => {
    if (typeClass(ev[3]) !== "match" || eventEquipe(ev) !== activeTeam || eventDateObj(ev) < now) return false;
    if (homeFilter === "home") return isHomeMatch(ev[5]);
    if (homeFilter === "away") return !isHomeMatch(ev[5]);
    return true; // "both"
  }).sort((a, b) => eventDateObj(a) - eventDateObj(b));
}

// section identifie quelle liste ouvrir dans la fiche (voir renderGestionMatchsDetailSheet) au
// tap sur l'en-tête — le raccourci personnel (cp-edit-box, juste en dessous) reste lui toujours
// directement sur la carte, jamais caché dans la fiche.
function matchCardHeader(ev, badges, section) {
  const [id, , , , titre, lieu] = ev;
  const d = eventDateObj(ev);
  const dateLabel = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "").toUpperCase();
  return `<div class="cp-match-head sheet-open-zone" data-open-gm-detail="${section}|||${escapeHtml(id)}">
    <div><div class="cp-match-title">${escapeHtml(titre || "Match")}</div><div class="cp-match-sub">${dateLabel} · ${formatHeure(ev) || ""} · ${escapeHtml(lieu || "")}</div></div>
    <div style="display:flex; gap:6px;">${badges}</div>
  </div>`;
}

// Fiche (bottom sheet) listant qui fait quoi pour un match, sur l'une des 4 sections
// Covoiturage/Goûter/Table de marque/Maillots — ouverte au tap sur l'en-tête d'une carte.
function renderGestionMatchsDetailSheet() {
  const ctx = window.__gmDetailFor;
  if (!ctx) return "";
  const [section, matchId] = ctx.split("|||");
  const ev = evenements.find(e => e[0] === matchId);
  if (!ev) return "";
  const [, , , , titre, lieu] = ev;
  const displayTitre = typeClass(ev[3]) === "match" ? formatMatchDisplay(titre, lieu).label : (titre || "Événement");

  const emptyRow = `<div class="cp-empty">Personne pour l'instant</div>`;
  const personRow = (nom, extra) => `<div class="cp-row"><span>${escapeHtml(nom)}</span>${extra ? `<span class="places">${escapeHtml(extra)}</span>` : ""}</div>`;

  let sectionLabel = "", bodyHtml = "";
  if (section === "covoiturage") {
    sectionLabel = "Covoiturage";
    const entries = covoiturage.filter(r => r[0] === matchId);
    const drivers = entries.filter(r => r[2] === "Oui");
    const needers = entries.filter(r => r[4] === "Oui");
    bodyHtml = `<div class="cp-col-h driver">🚗 Conducteurs (${drivers.length})</div>
      ${drivers.length === 0 ? emptyRow : drivers.map(r => personRow(r[1], (r[3] || "?") + " places")).join("")}
      <div class="cp-col-h need" style="margin-top:12px;">🙋 Cherchent une place (${needers.length})</div>
      ${needers.length === 0 ? emptyRow : needers.map(r => personRow(r[1])).join("")}`;
  } else if (section === "gouter") {
    sectionLabel = "Goûter";
    const entries = gouterSignupsFor(matchId);
    bodyHtml = `<div class="cp-col-h" style="color:#c98cf0;">🍪 Choses apportées (${entries.length})</div>
      ${entries.length === 0 ? emptyRow : entries.map(r => personRow(r[1], r[2])).join("")}`;
  } else if (section === "tablemarque") {
    sectionLabel = "Table de marque";
    const entries = tableMarque.filter(r => r[0] === matchId);
    bodyHtml = `<div class="cp-col-h driver">📋 Disponibles (${entries.length})</div>
      ${entries.length === 0 ? emptyRow : entries.map(r => personRow(r[1])).join("")}`;
  } else if (section === "maillots") {
    sectionLabel = "Maillots";
    const entries = maillots.filter(r => r[0] === matchId && r[2] === "Oui");
    bodyHtml = `<div class="cp-col-h" style="color:#E8B84B;">👕 Prennent les maillots (${entries.length})</div>
      ${entries.length === 0 ? emptyRow : entries.map(r => personRow(r[1])).join("")}`;
  } else {
    return "";
  }

  return `<div class="sheet-overlay open" data-close-sheet="gmDetailFor">
    <div class="sheet-scrim" data-close-sheet="gmDetailFor"></div>
    <div class="sheet">
      <div class="sheet-close" data-close-sheet="gmDetailFor">✕</div>
      <div class="sheet-grab"></div>
      <div class="sheet-hero">
        <div class="sheet-hero-eyebrow">${escapeHtml(sectionLabel)}</div>
        <h2>${escapeHtml(displayTitre)}</h2>
        <p>${formatEventDateFr(ev)}${lieu ? " · " + escapeHtml(lieu) : ""}</p>
      </div>
      <div class="sheet-body">${bodyHtml}</div>
    </div>
  </div>`;
}

function renderCovoiturageSection(activeTeam) {
  const matches = gestionMatchsUpcoming(activeTeam, "away");
  if (matches.length === 0) return `<div class="card"><div class="muted">Aucun match à l'extérieur à venir pour cette équipe.</div></div>`;
  const identities = myCarpoolIdentitiesForTeam(activeTeam);
  let html = "";
  matches.forEach(ev => {
    const id = ev[0];
    const entries = covoiturage.filter(r => r[0] === id);
    const drivers = entries.filter(r => r[2] === "Oui");
    const needers = entries.filter(r => r[4] === "Oui");
    const totalPlaces = drivers.reduce((s, r) => s + (parseInt(r[3], 10) || 0), 0);
    html += `<div class="cp-match-card">` + matchCardHeader(ev, `
      <div class="cp-summary-badge"><div class="num" style="color:#33d17a;">${totalPlaces}</div><div class="lbl">Places</div></div>
      <div class="cp-summary-badge"><div class="num" style="color:#ffb43c;">${needers.length}</div><div class="lbl">Demandes</div></div>
    `, "covoiturage");

    if (identities.length === 0) {
      html += `<div class="muted" style="font-size:9.5px; margin-top:10px; text-align:center;">Seul ton parent peut modifier cette page pour toi.</div>`;
    } else {
      identities.forEach(idt => {
        const entry = covoitEntryFor(id, idt.nom);
        const jeConduit = entry ? entry[2] : "";
        const places = entry ? entry[3] : "3";
        const besoinPlace = entry ? entry[4] : "";
        html += `<div class="cp-edit-box">
          <div class="cp-edit-label">${idt.isChild ? `Pour ${escapeHtml(idt.nom)} <span class="cp-for-child">ton enfant</span>` : "Toi"}</div>
          <div class="cp-toggle-row">
            <button type="button" class="cp-toggle-btn ${jeConduit === "Oui" ? "active-yes" : ""}" data-cp-conduit="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">Je conduis</button>
            <button type="button" class="cp-toggle-btn ${besoinPlace === "Oui" ? "active-need" : ""}" data-cp-besoin="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">J'ai besoin d'une place</button>
          </div>
          ${jeConduit === "Oui" ? `<div class="cp-edit-label">Nombre de places disponibles</div>
          <select data-cp-places="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">
            ${[1,2,3,4,5].map(n => `<option value="${n}" ${String(places) === String(n) ? "selected" : ""}>${n}</option>`).join("")}
          </select>` : ""}
        </div>`;
      });
    }
    html += `</div>`;
  });
  return html;
}

function renderGouterSection(activeTeam) {
  const matches = gestionMatchsUpcoming(activeTeam, "home");
  if (matches.length === 0) return `<div class="card"><div class="muted">Aucun match à domicile à venir pour cette équipe.</div></div>`;
  const identities = myCarpoolIdentitiesForTeam(activeTeam);
  const isAdmin = hasRole("Admin");
  let html = "";
  matches.forEach(ev => {
    const id = ev[0];
    const signups = gouterSignupsFor(id);
    const options = gouterOptionsFor(id);
    html += `<div class="cp-match-card">` + matchCardHeader(ev, `
      <div class="cp-summary-badge"><div class="num" style="color:#c98cf0;">${signups.length}</div><div class="lbl">Inscrits</div></div>
    `, "gouter");

    html += `<div class="cp-col-h" style="color:#c98cf0;">Qui amène quoi</div>`;
    if (signups.length === 0) {
      html += `<div class="cp-empty">Personne pour l'instant</div>`;
    } else {
      signups.forEach(s => { html += `<div class="cp-row"><span>${escapeHtml(s[1])}</span><span class="places">${escapeHtml(s[2])}</span></div>`; });
    }

    if (identities.length === 0) {
      html += `<div class="muted" style="font-size:9.5px; margin-top:10px; text-align:center;">Seul ton parent peut modifier cette page pour toi.</div>`;
    } else {
      identities.forEach(idt => {
        html += `<div class="cp-edit-box">
          <div class="cp-edit-label">${idt.isChild ? `Pour ${escapeHtml(idt.nom)} <span class="cp-for-child">ton enfant</span>` : "Toi"}</div>
          ${options.map(o => {
            const checked = gouterHasItem(id, idt.nom, o);
            return `<label style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:12.5px; color:#e8e8ee;">
              <input type="checkbox" data-gouter-item="${escapeHtml(id)}|||${escapeHtml(idt.nom)}|||${escapeHtml(o)}" ${checked ? "checked" : ""} style="width:17px; height:17px; flex-shrink:0;" />
              ${escapeHtml(o)}
            </label>`;
          }).join("")}
          ${options.length === 0 ? `<div class="muted" style="font-size:10.5px; margin-bottom:6px;">Aucun choix proposé pour l'instant — sois le premier à en ajouter un.</div>` : ""}
          <div class="carte-propose" style="margin-top:6px;"><input type="text" placeholder="Ajouter un nouveau choix..." id="gouter-propose-${id}-${idt.nom}" /><button type="button" class="btn secondary" style="width:auto; padding:8px 12px;" data-gouter-propose="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">Ajouter</button></div>
          ${isAdmin && options.length > 0 ? `<div class="muted" style="font-size:9.5px; margin-top:6px;">Retirer un choix : ${options.map(o => `<span class="cp-for-child" style="cursor:pointer;" data-gouter-remove-option="${escapeHtml(id)}|||${escapeHtml(o)}">${escapeHtml(o)} ✕</span>`).join(" ")}</div>` : ""}
        </div>`;
      });
    }
    html += `</div>`;
  });
  return html;
}

function renderTableMarqueSection(activeTeam) {
  const matches = gestionMatchsUpcoming(activeTeam, "both");
  if (matches.length === 0) return `<div class="card"><div class="muted">Aucun match à venir pour cette équipe.</div></div>`;
  const identities = myCarpoolIdentitiesForTeam(activeTeam);
  let html = "";
  matches.forEach(ev => {
    const id = ev[0];
    const entries = tableMarque.filter(r => r[0] === id);
    html += `<div class="cp-match-card">` + matchCardHeader(ev, `
      <div class="cp-summary-badge"><div class="num" style="color:#33d17a;">${entries.length}</div><div class="lbl">Disponibles</div></div>
    `, "tablemarque");

    if (identities.length === 0) {
      html += `<div class="muted" style="font-size:9.5px; margin-top:10px; text-align:center;">Seul ton parent peut modifier cette page pour toi.</div>`;
    } else {
      identities.forEach(idt => {
        const entry = tableMarqueEntryFor(id, idt.nom);
        const dispo = entry ? entry[2] : "";
        html += `<div class="cp-edit-box">
          <div class="cp-edit-label">${idt.isChild ? `Pour ${escapeHtml(idt.nom)} <span class="cp-for-child">ton enfant</span>` : "Toi"}</div>
          <button type="button" class="cp-toggle-btn ${dispo === "Oui" ? "active-yes" : ""}" style="width:100%;" data-tm-dispo="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">Je suis disponible</button>
        </div>`;
      });
    }
    html += `</div>`;
  });
  return html;
}

function renderMaillotsSection(activeTeam) {
  const matches = gestionMatchsUpcoming(activeTeam, "both");
  const identities = myCarpoolIdentitiesForTeam(activeTeam);

  const roster = activeTeam === "U17M1" ? compositionRoster() : rosterForEquipe(activeTeam);
  const counts = roster.map(nom => ({ nom, n: maillotsCountFor(nom) })).sort((a, b) => b.n - a.n);
  let html = `<div class="card">
    <div class="section-h" style="margin-top:0;">Compteur saison</div>
    ${counts.length === 0 ? `<div class="muted">Aucun joueur enregistré pour cette équipe.</div>` : counts.map(c => `<div class="cp-row"><span>${escapeHtml(c.nom)}</span><span class="places">${c.n} fois</span></div>`).join("")}
  </div>`;

  if (matches.length === 0) return html + `<div class="card"><div class="muted">Aucun match à venir pour cette équipe.</div></div>`;

  matches.forEach(ev => {
    const id = ev[0];
    const entries = maillots.filter(r => r[0] === id && r[2] === "Oui");
    html += `<div class="cp-match-card">` + matchCardHeader(ev, `
      <div class="cp-summary-badge"><div class="num" style="color:#E8B84B;">${entries.length}</div><div class="lbl">Pris</div></div>
    `, "maillots");

    if (identities.length === 0) {
      html += `<div class="muted" style="font-size:9.5px; margin-top:10px; text-align:center;">Seul ton parent peut modifier cette page pour toi.</div>`;
    } else {
      identities.forEach(idt => {
        const entry = maillotsEntryFor(id, idt.nom);
        const pris = entry ? entry[2] : "";
        html += `<div class="cp-edit-box">
          <div class="cp-edit-label">${idt.isChild ? `Pour ${escapeHtml(idt.nom)} <span class="cp-for-child">ton enfant</span>` : "Toi"}</div>
          <button type="button" class="cp-toggle-btn ${pris === "Oui" ? "active-yes" : ""}" style="width:100%;" data-maillots-pris="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">Je prends les maillots</button>
        </div>`;
      });
    }
    html += `</div>`;
  });
  return html;
}

// Historique + à venir, tous les matchs à domicile du club (les plus récents en premier) — pas
// scoping par équipe, contrairement aux autres sections : un foodtruck ne concerne aucune
// équipe en particulier, il vient pour une date/un match donné quelle que soit l'équipe qui joue.
function foodtruckHomeMatches() {
  const teams = myCarpoolTeams().filter(t => t !== "SM1");
  return evenements.filter(ev => typeClass(ev[3]) === "match" && teams.includes(eventEquipe(ev)) && isHomeMatch(ev[5]))
    .sort((a, b) => eventDateObj(b) - eventDateObj(a));
}

function foodtruckEntriesFor() {
  const ids = new Set(foodtruckHomeMatches().map(ev => ev[0]));
  return foodtrucks.filter(r => ids.has(r[1]));
}

// Sélecteur "liste" pour le nom du foodtruck : catalogue des habitués + option "Autre" avec
// saisie libre pour un nouveau passage ponctuel (voir addFoodtruckCatalogApi pour l'ajouter au
// catalogue dans la foulée). idPrefix distingue le formulaire d'ajout de ceux d'édition en ligne.
function renderFoodtruckNomSelect(idPrefix, currentNom) {
  const inCatalog = foodtrucksCatalog.some(r => r[0] === currentNom);
  const isAutre = !!currentNom && !inCatalog;
  let html = `<select id="${idPrefix}-nom-select">
    <option value="">— Choisir —</option>
    ${foodtrucksCatalog.map(r => `<option value="${escapeHtml(r[0])}" ${currentNom === r[0] ? "selected" : ""}>${escapeHtml(r[0])}</option>`).join("")}
    <option value="__autre__" ${isAutre ? "selected" : ""}>Autre (saisir un nom)…</option>
  </select>`;
  html += `<input id="${idPrefix}-nom-autre" type="text" placeholder="Nom du foodtruck" value="${escapeHtml(isAutre ? currentNom : "")}" style="margin-top:6px; ${isAutre ? "" : "display:none;"}" />`;
  return html;
}

function renderFoodtruckCatalogCard() {
  let html = `<div class="section-h" style="margin-top:14px;">Catalogue des foodtrucks habituels</div>`;
  html += `<div class="card">`;
  if (foodtrucksCatalog.length === 0) {
    html += `<div class="muted" style="font-size:12px;">Aucun foodtruck enregistré — ajoute-en un ci-dessous pour le retrouver dans la liste déroulante.</div>`;
  } else {
    foodtrucksCatalog.forEach(([nom]) => {
      html += `<div class="paiement-row">
        <div style="font-weight:700; color:#e8e8ee;">${escapeHtml(nom)}</div>
        ${iconBtn(ICON_CROSS, "ev-del", `data-delete-foodtruck-catalog="${escapeHtml(nom)}"`)}
      </div>`;
    });
  }
  html += `<button class="btn add-btn-primary" id="toggle-add-foodtruck-catalog" style="margin-top:10px;">${window.__showAddFoodtruckCatalog ? "− Fermer" : "+ Ajouter un foodtruck au catalogue"}</button>`;
  if (window.__showAddFoodtruckCatalog) {
    html += `<div class="add-form">
      <label class="field-label">Nom du foodtruck</label>
      <input id="foodtruck-catalog-nom" type="text" placeholder="Ex: Chez Mario — Pizza" />
      <button class="btn" id="foodtruck-catalog-add" style="margin-top:6px;">Ajouter au catalogue</button>
    </div>`;
  }
  html += `</div>`;
  return html;
}

// Vignette cliquable (liste "Historique") ouvrant la photo du menu en grand — voir
// renderMenuImagePopup. Le club ne prenant pas de bénéfice sur les foodtrucks, il n'y a plus de
// prix/bénéfice à afficher à côté, juste la photo du menu telle que fournie par le foodtruck.
function renderMenuThumb(url) {
  if (!url) return "";
  return `<img src="${escapeHtml(url)}" alt="Menu" class="foodtruck-menu-thumb" data-open-menu-image="${escapeHtml(url)}" />`;
}

function renderFoodtruckSection() {
  const matches = foodtruckHomeMatches();
  const entries = foodtruckEntriesFor();

  let html = `<button class="btn add-btn-primary" id="toggle-add-foodtruck">+ Ajouter un passage foodtruck</button>`;

  html += renderFoodtruckCatalogCard();

  html += `<div class="section-h">Historique</div>`;
  if (entries.length === 0) {
    html += `<div class="card muted">Aucun passage foodtruck enregistré pour le moment.</div>`;
  } else {
    html += `<div class="card">`;
    entries.slice().reverse().forEach(r => {
      const [id, eventId, nom, , , notes, menuImageUrl] = r;
      const ev = evenements.find(e => e[0] === eventId);
      const evLabel = ev ? `${eventDateObj(ev).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · ${eventEquipe(ev)} · ${formatMatchDisplay(ev[4], ev[5]).label || ev[4] || "Match"}` : "Match supprimé";
      if (window.__editingFoodtruckId === id) {
        html += `<div class="paiement-row" style="display:block; padding:10px 0;">
          <label class="field-label">Foodtruck</label>
          ${renderFoodtruckNomSelect(`edit-foodtruck-${id}`, nom || "")}
          <label class="field-label" style="margin-top:6px;">Match associé</label>
          <select id="edit-foodtruck-event-${id}" style="margin-bottom:6px;">
            ${matches.map(m => `<option value="${escapeHtml(m[0])}" ${m[0] === eventId ? "selected" : ""}>${eventDateObj(m).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} — ${escapeHtml(eventEquipe(m))} — ${escapeHtml(formatMatchDisplay(m[4], m[5]).label || m[4] || "Match")}</option>`).join("")}
          </select>
          <label class="field-label">Menu</label>
          ${renderMenuImagePicker(`edit-foodtruck-${id}`, menuImageUrl || "")}
          <label class="field-label">Notes</label>
          <input id="edit-foodtruck-notes-${id}" type="text" value="${escapeHtml(notes || "")}" style="margin-bottom:8px;" />
          <div class="row-flex">
            <button class="btn" style="flex:1;" data-save-foodtruck="${id}">Enregistrer</button>
            <button class="btn secondary" style="flex:1;" data-cancel-edit-foodtruck="1">Annuler</button>
          </div>
        </div>`;
      } else {
        html += `<div class="paiement-row" style="align-items:flex-start;">
          ${renderMenuThumb(menuImageUrl)}
          <div style="flex:1;">
            <div style="font-weight:700; color:#e8e8ee;">${escapeHtml(nom || "Foodtruck")}</div>
            <div class="muted" style="font-size:11px; margin-top:2px;">${escapeHtml(evLabel)}</div>
            ${notes ? `<div class="muted" style="font-size:11px; margin-top:2px;">${escapeHtml(notes)}</div>` : ""}
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${iconBtn(ICON_EDIT, "ev-edit", `data-edit-foodtruck="${id}"`)}
            ${iconBtn(ICON_CROSS, "ev-del", `data-delete-foodtruck="${id}"`)}
          </div>
        </div>`;
      }
    });
    html += `</div>`;
  }

  html += renderAddFoodtruckSheet(matches);

  return html;
}

// ===================== FICHE AJOUT FOODTRUCK (bottom sheet) =====================
function renderAddFoodtruckSheet(matches) {
  if (!window.__showAddFoodtruck) return "";
  const bodyHtml = matches.length === 0
    ? `<div class="muted">Aucun match à domicile enregistré pour l'instant.</div>`
    : `
      <label class="field-label">Foodtruck</label>
      ${renderFoodtruckNomSelect("foodtruck", "")}
      <label class="field-label">Match associé</label>
      <select id="foodtruck-event">
        ${matches.map(ev => `<option value="${escapeHtml(ev[0])}">${eventDateObj(ev).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} — ${escapeHtml(eventEquipe(ev))} — ${escapeHtml(formatMatchDisplay(ev[4], ev[5]).label || ev[4] || "Match")}</option>`).join("")}
      </select>
      <label class="field-label">Menu</label>
      ${renderMenuImagePicker("foodtruck", "")}
      <label class="field-label">Notes (optionnel)</label>
      <input id="foodtruck-notes" type="text" placeholder="Ex: bien venu, prévoir 2 emplacements..." />
      <button class="btn" id="foodtruck-add" style="margin-top:12px;">Enregistrer</button>`;

  return `<div class="sheet-overlay open" data-close-sheet="showAddFoodtruck">
    <div class="sheet-scrim" data-close-sheet="showAddFoodtruck"></div>
    <div class="sheet">
      <div class="sheet-close" data-close-sheet="showAddFoodtruck">✕</div>
      <div class="sheet-grab"></div>
      <div class="sheet-hero">
        <div class="sheet-hero-eyebrow">Gestion des matchs</div>
        <h2>Ajouter un passage foodtruck</h2>
      </div>
      <div class="sheet-body">${bodyHtml}</div>
    </div>
  </div>`;
}

function renderGestionMatchsPage() {
  // Le SM1 n'est pas concerné par cette page (covoiturage/goûter/table de marque/maillots ne
  // s'appliquent qu'aux équipes U17M1/U13M1) — voir cartes.js pour l'équivalent SM1 (repas/apéro).
  const teams = myCarpoolTeams().filter(t => t !== "SM1");
  if (teams.length === 0) {
    return `<div class="page-title">Gestion des matchs</div><div class="card"><div class="muted">Aucune équipe concernée pour ce compte.</div></div>`;
  }
  const activeTeam = (window.__covoitTeamView && teams.includes(window.__covoitTeamView)) ? window.__covoitTeamView : teams[0];
  const sortedSections = gestionMatchsSectionsSorted();
  const section = sortedSections.some(s => s.id === window.__gestionMatchsSection) ? window.__gestionMatchsSection : (sortedSections[0] ? sortedSections[0].id : "covoiturage");
  // Foodtrucks et catalogue restaurants ne concernent aucune équipe en particulier.
  const needsTeam = section !== "foodtruck" && section !== "restaurants";

  let html = `<div class="page-title">Gestion des matchs</div><div class="page-sub">Covoiturage, goûter, table de marque et maillots${needsTeam ? " — équipe " + escapeHtml(activeTeam) : ""}</div>`;
  if (needsTeam) html += renderTeamSwitcher(teams, activeTeam, "covoit-team");
  html += `<div class="gm-section-grid">
    ${sortedSections.map(s => `<button type="button" class="gm-section-chip ${section === s.id ? 'active' : ''}" data-gestion-matchs-section="${s.id}">${s.label}</button>`).join("")}
  </div>`;

  if (section === "covoiturage") html += renderCovoiturageSection(activeTeam);
  else if (section === "gouter") html += renderGouterSection(activeTeam);
  else if (section === "tablemarque") html += renderTableMarqueSection(activeTeam);
  else if (section === "maillots") html += renderMaillotsSection(activeTeam);
  else if (section === "foodtruck" && canManageFoodtrucks()) html += renderFoodtruckSection();
  else if (section === "restaurants" && canManageRestaurants()) html += renderRestaurantsSection();

  if (window.__gmDetailFor) html += renderGestionMatchsDetailSheet();

  html += renderMenuImagePopup();

  return html;
}

// ===================== PHOTO DU MENU (foodtrucks) =====================
// window.__pendingMenuImage[idPrefix] : URL en attente d'enregistrement pour un formulaire
// donné, une fois la photo envoyée sur Drive (voir attachMenuImagePickerEvents). Distinct de la
// valeur déjà enregistrée (menuImageUrl passé à renderMenuImagePicker) pour ne pas la perdre si
// l'utilisateur annule sans valider.

function readMenuImageUrl(idPrefix, existingUrl) {
  if (window.__pendingMenuImage && Object.prototype.hasOwnProperty.call(window.__pendingMenuImage, idPrefix)) {
    return window.__pendingMenuImage[idPrefix];
  }
  return existingUrl || "";
}

function clearPendingMenuImage(idPrefix) {
  if (window.__pendingMenuImage) delete window.__pendingMenuImage[idPrefix];
}

function renderMenuImagePicker(idPrefix, existingUrl) {
  const currentUrl = readMenuImageUrl(idPrefix, existingUrl);
  if (window.__menuImageUploading === idPrefix) {
    return `<div class="muted" style="font-size:11px;">Envoi de la photo en cours...</div>`;
  }
  if (currentUrl) {
    return `<div class="menu-image-picker-preview">
      <img src="${escapeHtml(currentUrl)}" alt="Menu" />
      <button type="button" class="btn secondary" style="width:auto; padding:6px 10px; font-size:11px; margin-top:6px;" data-remove-menu-image="${escapeHtml(idPrefix)}">Retirer la photo</button>
    </div>`;
  }
  return `<input type="file" accept="image/*" data-menu-file-prefix="${escapeHtml(idPrefix)}" />`;
}

// Popup centré, refermable en cliquant à côté ou sur ✕ — l'image tient dans le popup par défaut
// (défilement possible si elle dépasse) ; un tap dessus bascule vers sa taille réelle, avec
// défilement horizontal/vertical si elle est trop grande pour l'écran (voir css .menu-image-*).
function renderMenuImagePopup() {
  if (!window.__menuImagePopupUrl) return "";
  const zoomed = !!window.__menuImagePopupZoomed;
  return `<div class="menu-image-overlay" data-close-menu-image="1">
    <div class="menu-image-close" data-close-menu-image="1">✕</div>
    <div class="menu-image-scroll ${zoomed ? "zoomed" : ""}">
      <img src="${escapeHtml(window.__menuImagePopupUrl)}" alt="Menu" data-toggle-menu-image-zoom="1" />
    </div>
  </div>`;
}

function attachMenuImagePickerEvents() {
  document.querySelectorAll("[data-menu-file-prefix]").forEach(el => {
    el.onchange = async () => {
      const idPrefix = el.dataset.menuFilePrefix;
      const file = el.files && el.files[0];
      if (!file) return;
      window.__menuImageUploading = idPrefix;
      render();
      try {
        const compressed = await compressImageFile(file, 1600, 0.8);
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(",")[1];
          const url = await uploadFoodtruckMenuImageApi(base64);
          window.__menuImageUploading = null;
          window.__pendingMenuImage = window.__pendingMenuImage || {};
          window.__pendingMenuImage[idPrefix] = url || "";
          render();
        };
        reader.readAsDataURL(compressed);
      } catch (err) {
        window.__menuImageUploading = null;
        showToast("Échec de l'envoi de la photo", "error");
        render();
      }
    };
  });

  document.querySelectorAll("[data-remove-menu-image]").forEach(el => {
    el.onclick = () => {
      window.__pendingMenuImage = window.__pendingMenuImage || {};
      window.__pendingMenuImage[el.dataset.removeMenuImage] = "";
      render();
    };
  });

  document.querySelectorAll("[data-open-menu-image]").forEach(el => {
    el.onclick = () => {
      vibrate();
      window.__menuImagePopupUrl = el.dataset.openMenuImage;
      window.__menuImagePopupZoomed = false;
      render();
    };
  });

  document.querySelectorAll("[data-close-menu-image]").forEach(el => {
    el.onclick = (e) => {
      if (e.target !== e.currentTarget) return; // ne ferme pas si on clique sur l'image elle-même
      window.__menuImagePopupUrl = null;
      render();
    };
  });

  document.querySelectorAll("[data-toggle-menu-image-zoom]").forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      window.__menuImagePopupZoomed = !window.__menuImagePopupZoomed;
      render();
    };
  });
}

async function uploadFoodtruckMenuImageApi(base64) {
  try {
    const body = JSON.stringify({ action: "uploadFoodtruckMenuImage", base64, mimeType: "image/jpeg", filename: "menu.jpg", authNom: session.nom, authCode: session.code });
    const res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    const data = await res.json();
    if (data.ok) return data.url;
    showToast("Échec de l'envoi de la photo", "error");
    return "";
  } catch (err) {
    isOnline = false;
    showToast("Échec de l'envoi de la photo", "error");
    return "";
  }
}

// ===================== ACTIONS API : FOODTRUCKS =====================

async function addFoodtruckApi(eventId, nom, menuImageUrl, notes) {
  const tempId = "temp_" + Date.now();
  foodtrucks.push([tempId, eventId, nom, "", "", notes || "", menuImageUrl || ""]);
  render();
  try {
    const params = new URLSearchParams({ action: "addFoodtruck", eventId, nom, notes: notes || "", menuImageUrl: menuImageUrl || "", authNom: session.nom, authCode: session.code });
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();
    if (data.ok) {
      await fetchAll();
    } else {
      foodtrucks = foodtrucks.filter(r => r[0] !== tempId);
      showToast("Échec de l'ajout", "error");
      render();
    }
  } catch (err) {
    isOnline = false;
    foodtrucks = foodtrucks.filter(r => r[0] !== tempId);
    showToast("Échec de l'ajout", "error");
    render();
  }
}

async function updateFoodtruckApi(id, eventId, nom, menuImageUrl, notes) {
  try {
    const params = new URLSearchParams({ action: "updateFoodtruck", id, eventId, nom, notes: notes || "", menuImageUrl: menuImageUrl || "", authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    window.__editingFoodtruckId = null;
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function deleteFoodtruckApi(id) {
  try {
    const params = new URLSearchParams({ action: "deleteFoodtruck", id, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    await fetchAll();
  } catch (err) { isOnline = false; render(); }
}

async function addFoodtruckCatalogApi(nom) {
  const tempPresent = foodtrucksCatalog.some(r => r[0] === nom);
  if (!tempPresent) { foodtrucksCatalog.push([nom, ""]); render(); }
  try {
    const params = new URLSearchParams({ action: "addFoodtruckCatalog", nom, authNom: session.nom, authCode: session.code });
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();
    if (data.ok) {
      await fetchAll();
    } else {
      foodtrucksCatalog = foodtrucksCatalog.filter(r => r[0] !== nom);
      showToast(data.error === "deja_present" ? "Ce foodtruck est déjà dans le catalogue" : "Échec de l'ajout", "error");
      render();
    }
  } catch (err) {
    isOnline = false;
    foodtrucksCatalog = foodtrucksCatalog.filter(r => r[0] !== nom);
    showToast("Échec de l'ajout", "error");
    render();
  }
}

async function deleteFoodtruckCatalogApi(nom) {
  const backup = foodtrucksCatalog;
  foodtrucksCatalog = foodtrucksCatalog.filter(r => r[0] !== nom);
  render();
  try {
    const params = new URLSearchParams({ action: "deleteFoodtruckCatalog", nom, authNom: session.nom, authCode: session.code });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    await fetchAll();
  } catch (err) {
    isOnline = false;
    foodtrucksCatalog = backup;
    render();
  }
}

// Historique du covoiturage (matchs passés) pour une personne donnée — utilisé notamment sur
// le Profil des parents, pour voir ce qui a été renseigné pour leur enfant au fil de la saison.
function renderCovoiturageHistoryCard(nom) {
  const now = new Date();
  const entries = covoiturage.filter(r => r[1] === nom).map(r => {
    const ev = evenements.find(e => e[0] === r[0]);
    return ev ? { ev, jeConduit: r[2], besoinPlace: r[4] } : null;
  }).filter(Boolean).filter(x => eventDateObj(x.ev) < now).sort((a, b) => eventDateObj(b.ev) - eventDateObj(a.ev));

  let html = `<div class="card"><div class="section-h" style="margin-top:0;">Historique covoiturage</div>`;
  if (entries.length === 0) {
    html += `<div class="muted">Aucun historique pour le moment.</div>`;
  } else {
    entries.slice(0, 8).forEach(({ ev, jeConduit, besoinPlace }) => {
      const d = eventDateObj(ev);
      const dateLabel = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "").toUpperCase();
      const statut = jeConduit === "Oui" ? "🚗 A conduit" : (besoinPlace === "Oui" ? "🙋 A eu besoin d'une place" : "—");
      html += `<div class="paiement-row"><div>${dateLabel} — ${escapeHtml(ev[4] || "Match")}</div><div class="muted" style="font-size:11px;">${statut}</div></div>`;
    });
  }
  html += `</div>`;
  return html;
}

function attachGestionMatchsEvents() {
  document.querySelectorAll("[data-open-gm-detail]").forEach(el => {
    el.onclick = () => {
      vibrate();
      window.__gmDetailFor = el.dataset.openGmDetail;
      render();
    };
  });

  document.querySelectorAll("[data-gestion-matchs-section]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const id = el.dataset.gestionMatchsSection;
      window.__gestionMatchsSection = id;
      bumpGestionMatchsUsage(id);
      render();
    };
  });

  document.querySelectorAll("[data-covoit-team]").forEach(el => {
    el.onclick = () => { vibrate(); window.__covoitTeamView = el.dataset.covoitTeam; render(); };
  });

  document.querySelectorAll("[data-cp-conduit]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const [eventId, nom] = el.dataset.cpConduit.split("|||");
      const entry = covoitEntryFor(eventId, nom);
      const newVal = (entry && entry[2] === "Oui") ? "" : "Oui";
      const places = (entry && entry[3]) || "3";
      const besoin = newVal === "Oui" ? "" : (entry ? entry[4] : "");
      setCovoiturageApi(nom, eventId, newVal, places, besoin);
    };
  });

  document.querySelectorAll("[data-cp-besoin]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const [eventId, nom] = el.dataset.cpBesoin.split("|||");
      const entry = covoitEntryFor(eventId, nom);
      const newVal = (entry && entry[4] === "Oui") ? "" : "Oui";
      const jeConduit = newVal === "Oui" ? "" : (entry ? entry[2] : "");
      const places = (entry && entry[3]) || "";
      setCovoiturageApi(nom, eventId, jeConduit, places, newVal);
    };
  });

  document.querySelectorAll("[data-cp-places]").forEach(el => {
    el.onchange = () => {
      const [eventId, nom] = el.dataset.cpPlaces.split("|||");
      const entry = covoitEntryFor(eventId, nom);
      setCovoiturageApi(nom, eventId, "Oui", el.value, entry ? entry[4] : "");
    };
  });

  document.querySelectorAll("[data-gouter-item]").forEach(el => {
    el.onchange = () => {
      vibrate();
      const [eventId, nom, item] = el.dataset.gouterItem.split("|||");
      setGouterItemApi(nom, eventId, item, el.checked);
    };
  });

  document.querySelectorAll("[data-gouter-propose]").forEach(el => {
    el.onclick = () => {
      const [eventId, nom] = el.dataset.gouterPropose.split("|||");
      const input = document.getElementById(`gouter-propose-${eventId}-${nom}`);
      const val = input ? input.value.trim() : "";
      if (val) {
        addGouterOptionApi(eventId, val).then(() => setGouterItemApi(nom, eventId, val, true));
      }
    };
  });

  document.querySelectorAll("[data-gouter-remove-option]").forEach(el => {
    el.onclick = () => {
      const [eventId, option] = el.dataset.gouterRemoveOption.split("|||");
      removeGouterOptionApi(eventId, option);
    };
  });

  document.querySelectorAll("[data-tm-dispo]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const [eventId, nom] = el.dataset.tmDispo.split("|||");
      const entry = tableMarqueEntryFor(eventId, nom);
      const newVal = (entry && entry[2] === "Oui") ? "" : "Oui";
      setTableMarqueApi(nom, eventId, newVal);
    };
  });

  document.querySelectorAll("[data-maillots-pris]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const [eventId, nom] = el.dataset.maillotsPris.split("|||");
      const entry = maillotsEntryFor(eventId, nom);
      const newVal = (entry && entry[2] === "Oui") ? "" : "Oui";
      setMaillotsApi(nom, eventId, newVal);
    };
  });

  const toggleAddFoodtruck = document.getElementById("toggle-add-foodtruck");
  if (toggleAddFoodtruck) toggleAddFoodtruck.onclick = () => {
    vibrate();
    window.__showAddFoodtruck = true;
    clearPendingMenuImage("foodtruck");
    render();
  };

  attachFoodtruckNomSelectEvents("foodtruck");
  attachMenuImagePickerEvents();

  const foodtruckAdd = document.getElementById("foodtruck-add");
  if (foodtruckAdd) foodtruckAdd.onclick = () => {
    const eventId = document.getElementById("foodtruck-event").value;
    const nom = readFoodtruckNomFromForm("foodtruck");
    const menuImageUrl = readMenuImageUrl("foodtruck", "");
    const notes = document.getElementById("foodtruck-notes").value.trim();
    if (!nom || !eventId) return;
    window.__showAddFoodtruck = false;
    clearPendingMenuImage("foodtruck");
    addFoodtruckApi(eventId, nom, menuImageUrl, notes);
  };

  document.querySelectorAll("[data-edit-foodtruck]").forEach(el => {
    el.onclick = () => { window.__editingFoodtruckId = el.dataset.editFoodtruck; render(); };
  });

  document.querySelectorAll("[data-cancel-edit-foodtruck]").forEach(el => {
    el.onclick = () => {
      clearPendingMenuImage(`edit-foodtruck-${window.__editingFoodtruckId}`);
      window.__editingFoodtruckId = null;
      render();
    };
  });

  if (window.__editingFoodtruckId) attachFoodtruckNomSelectEvents(`edit-foodtruck-${window.__editingFoodtruckId}`);

  document.querySelectorAll("[data-save-foodtruck]").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.saveFoodtruck;
      const eventId = document.getElementById(`edit-foodtruck-event-${id}`).value;
      const nom = readFoodtruckNomFromForm(`edit-foodtruck-${id}`);
      const existing = foodtrucks.find(r => r[0] === id);
      const menuImageUrl = readMenuImageUrl(`edit-foodtruck-${id}`, existing ? existing[6] : "");
      const notes = document.getElementById(`edit-foodtruck-notes-${id}`).value.trim();
      if (!nom || !eventId) return;
      clearPendingMenuImage(`edit-foodtruck-${id}`);
      updateFoodtruckApi(id, eventId, nom, menuImageUrl, notes);
    };
  });

  document.querySelectorAll("[data-delete-foodtruck]").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.deleteFoodtruck;
      if (confirm("Supprimer ce passage foodtruck ?")) deleteFoodtruckApi(id);
    };
  });

  const toggleAddFoodtruckCatalog = document.getElementById("toggle-add-foodtruck-catalog");
  if (toggleAddFoodtruckCatalog) toggleAddFoodtruckCatalog.onclick = () => {
    vibrate();
    window.__showAddFoodtruckCatalog = !window.__showAddFoodtruckCatalog;
    render();
  };

  const foodtruckCatalogAdd = document.getElementById("foodtruck-catalog-add");
  if (foodtruckCatalogAdd) foodtruckCatalogAdd.onclick = () => {
    const nom = document.getElementById("foodtruck-catalog-nom").value.trim();
    if (!nom) return;
    window.__showAddFoodtruckCatalog = false;
    addFoodtruckCatalogApi(nom);
  };

  document.querySelectorAll("[data-delete-foodtruck-catalog]").forEach(el => {
    el.onclick = () => {
      const nom = el.dataset.deleteFoodtruckCatalog;
      if (confirm(`Retirer "${nom}" du catalogue ?`)) deleteFoodtruckCatalogApi(nom);
    };
  });

  attachRestaurantsEvents(); // voir cartes.js — onglet Restaurants (catalogue resto/menus)
}

// idPrefix : préfixe des ids générés par renderFoodtruckNomSelect.
function attachFoodtruckNomSelectEvents(idPrefix) {
  const select = document.getElementById(`${idPrefix}-nom-select`);
  if (!select) return;
  select.onchange = () => {
    const autreInput = document.getElementById(`${idPrefix}-nom-autre`);
    const isAutre = select.value === "__autre__";
    if (autreInput) {
      autreInput.style.display = isAutre ? "" : "none";
      if (isAutre) autreInput.focus();
    }
  };
}

function readFoodtruckNomFromForm(idPrefix) {
  const select = document.getElementById(`${idPrefix}-nom-select`);
  if (!select) return "";
  if (select.value === "__autre__") {
    const autreInput = document.getElementById(`${idPrefix}-nom-autre`);
    return autreInput ? autreInput.value.trim() : "";
  }
  return select.value;
}
