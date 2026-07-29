// ===================================================================
// CARTES D'ÉVÉNEMENT — cartes optionnelles attachées à un événement SM1
// (voir renderEventCard dans agenda.js) : "repas" (sondage du lieu +
// répartition de l'addition) ou "apero" ("qui amène quoi", liste de
// choix extensible). Ajout/suppression réservés à Coach/Admin ;
// réponses ouvertes à tous (soi-même ou son enfant, comme covoiturage).
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

function renderRepasCard(carte, identities, canManage) {
  const [id, , , titre] = carte;
  const options = carteOptions(carte);
  const votes = carteReponsesFor(id, "vote");
  const participants = carteReponsesFor(id, "participe").filter(r => r[3] === "Oui");
  const total = parseFloat(carte[5]) || 0;
  const perPerson = participants.length ? total / participants.length : 0;

  const leadOption = options.slice().sort((a, b) => votes.filter(v => v[3] === b).length - votes.filter(v => v[3] === a).length)[0];
  const leadCount = leadOption ? votes.filter(v => v[3] === leadOption).length : 0;
  const summary = perPerson
    ? `${perPerson.toFixed(2)} €/pers · ${participants.length} participant${participants.length > 1 ? "s" : ""}`
    : (leadCount > 0 ? `${leadOption} en tête (${leadCount} vote${leadCount > 1 ? "s" : ""})` : "Aucune réponse pour l'instant");

  const expanded = !!(window.__carteExpanded && window.__carteExpanded[id]);
  if (!expanded) return renderCarteCollapsed(id, "🍽", titre || "Repas d'après match", summary);

  let html = `<div class="carte-box carte-repas">
    ${carteHeadHtml(id, "🍽", titre || "Repas d'après match", canManage)}
    <div class="carte-sub-h">Sondage du lieu</div>`;

  options.forEach(opt => {
    const count = votes.filter(v => v[3] === opt).length;
    html += `<div class="carte-option" data-carte-vote-option="${escapeHtml(id)}|||${escapeHtml(opt)}">
      <span>${escapeHtml(opt)}</span><span class="carte-option-count">${count} vote${count > 1 ? "s" : ""}</span>
    </div>`;
  });
  if (options.length === 0) html += `<div class="cp-empty">Aucune proposition pour l'instant</div>`;

  html += `<div class="carte-propose"><input type="text" placeholder="Proposer un lieu..." id="carte-propose-${id}" /><button type="button" class="btn secondary" style="width:auto; padding:8px 12px;" data-carte-propose="${escapeHtml(id)}">Ajouter</button></div>`;

  html += `<div class="carte-split-line">
      <span class="lbl">Total</span>${canManage
        ? `<input type="number" min="0" step="0.5" value="${total || ""}" class="carte-total-input" data-carte-total="${escapeHtml(id)}" />`
        : `<span class="num">${total}</span>`} €
      <span class="lbl">÷ ${participants.length} pers =</span>
      <span class="num accent">${perPerson ? perPerson.toFixed(2) : "—"} €</span>
    </div>`;

  identities.forEach(idt => {
    const myVote = carteReponseFor(id, idt.nom, "vote");
    const participe = carteReponseFor(id, idt.nom, "participe");
    html += `<div class="carte-identity">
      <div class="cp-edit-label">${idt.isChild ? `Pour ${escapeHtml(idt.nom)} <span class="cp-for-child">ton enfant</span>` : "Toi"}</div>
      ${myVote ? `<div class="muted" style="font-size:11px; margin-bottom:6px;">Vote actuel : ${escapeHtml(myVote[3])}</div>` : ""}
      <button type="button" class="cp-toggle-btn ${participe && participe[3] === "Oui" ? "active-yes" : ""}" style="width:100%;" data-carte-participe="${escapeHtml(id)}|||${escapeHtml(idt.nom)}">Je participe${perPerson ? ` (${perPerson.toFixed(2)} €)` : ""}</button>
    </div>`;
  });

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
      <button type="button" class="salaries-type-btn ${type === 'repas' ? 'active' : ''}" data-carte-type-pick="${escapeHtml(eventId)}|||repas">🍽 Sondage + répartition</button>
      <button type="button" class="salaries-type-btn ${type === 'apero' ? 'active' : ''}" data-carte-type-pick="${escapeHtml(eventId)}|||apero">🥂 Qui amène quoi</button>
    </div>
    <label class="field-label">Titre</label>
    <input id="carte-new-titre" type="text" placeholder="${type === 'repas' ? "ex: Repas d'après match" : 'ex: Apéro entre filles'}" />
    <label class="field-label">Choix de départ (un par ligne, facultatif)</label>
    <textarea id="carte-new-options" rows="3" placeholder="${type === 'repas' ? "La Table d'Hoenheim\nPizzeria Roma" : "Chips et gâteaux\nBoissons sans alcool"}"></textarea>
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
    const options = document.getElementById("carte-new-options").value.split("\n").map(s => s.trim()).filter(Boolean);
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

  document.querySelectorAll("[data-carte-total]").forEach(el => {
    el.onchange = () => setCarteTotalApi(el.dataset.carteTotal, el.value);
  });

  document.querySelectorAll("[data-carte-propose]").forEach(el => {
    el.onclick = () => {
      const carteId = el.dataset.cartePropose;
      const input = document.getElementById(`carte-propose-${carteId}`);
      const val = input ? input.value.trim() : "";
      if (val) addCarteOptionApi(carteId, val);
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

  document.querySelectorAll("[data-carte-vote-option]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const [carteId, option] = el.dataset.carteVoteOption.split("|||");
      // Vote pour la première identité éligible (soi-même en priorité) — simple et suffisant
      // pour un sondage collectif.
      const identities = myCarpoolIdentitiesForTeam("SM1");
      if (identities.length === 0) return;
      const nom = identities[0].nom;
      const current = carteReponseFor(carteId, nom, "vote");
      setCarteReponseApi(carteId, nom, "vote", current && current[3] === option ? "" : option);
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
