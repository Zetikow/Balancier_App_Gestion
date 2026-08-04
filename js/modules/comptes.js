// ===================================================================
// COMPTES — auto-service Coach ("Ajouter mes joueurs" depuis Profil)
// et page Admin "Gestion des comptes" (création de tout type de
// compte, liste par rôle, détail présence par personne). Module du
// coffret initial (pas un module payant), voir Profil.
// ===================================================================

const COMPTE_ROLE_ORDER = ["Admin", "Coach", "Joueur", "Salarié", "Bénévole", "Parent"];
const COMPTE_ROLE_LABELS = { Admin: "Admin", Coach: "Coachs", Joueur: "Joueurs", "Salarié": "Salariés", "Bénévole": "Bénévoles", Parent: "Parents" };

// Équipe à utiliser pour afficher les stats de présence d'un compte : celle où il est Joueur,
// sinon celle où il est Coach, sinon aucune (Admin/Salarié/Bénévole sans équipe rattachée).
function compteEquipeForPresence(row) {
  return rowEquipesForRole(row, "Joueur")[0] || rowEquipesForRole(row, "Coach")[0] || null;
}

function renderComptePersonCard(row, role, equipe) {
  const nom = row[0];
  const sub = role === "Parent" ? `Parent de ${equipe}` : (equipe && equipe !== "Toutes" ? teamDisplayLabel(equipe) : "");
  return `<div class="compte-person-card" data-open-compte-detail="${escapeHtml(nom)}">
    <div class="cn-avatar">${getInitials(nom)}</div>
    <div class="compte-person-name">${escapeHtml(nom)}</div>
    ${sub ? `<div class="muted" style="font-size:9.5px;">${escapeHtml(sub)}</div>` : ""}
  </div>`;
}

function renderAddCompteForm() {
  if (!window.__showAddCompte) return "";
  const role = window.__addCompteRole || "Joueur";
  const needsTeam = role === "Joueur" || role === "Coach";
  const needsChild = role === "Parent";
  const joueurNoms = comptes.slice(1).filter(c => rowHasRole(c, "Joueur")).map(c => c[0]);

  return `<div class="card add-form">
    <div class="section-h" style="margin-top:0;">Nouveau compte</div>
    <label class="field-label">Nom</label>
    <input id="ac-nom" type="text" placeholder="Nom complet" autocomplete="off" />
    <label class="field-label">Rôle</label>
    <select id="ac-role">
      ${COMPTE_ROLE_ORDER.map(r => `<option value="${r}" ${r === role ? "selected" : ""}>${r}</option>`).join("")}
    </select>
    ${needsTeam ? `<label class="field-label">Équipe</label>
      <select id="ac-equipe">${TEAMS.map(t => `<option value="${t}">${teamDisplayLabel(t)}</option>`).join("")}</select>` : ""}
    ${needsChild ? `<label class="field-label">Enfant (joueur)</label>
      <select id="ac-enfant">${joueurNoms.length === 0 ? `<option value="">Aucun joueur enregistré</option>` : joueurNoms.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("")}</select>` : ""}
    ${window.__addCompteError ? `<div class="login-error">${escapeHtml(window.__addCompteError)}</div>` : ""}
    <div class="row-flex" style="margin-top:10px;">
      <button class="btn" style="flex:1;" id="ac-submit">Créer le compte</button>
      <button class="btn secondary" style="flex:1;" id="ac-cancel">Annuler</button>
    </div>
  </div>`;
}

function renderGestionComptesPage() {
  if (!hasRole("Admin")) return `<div class="card muted">Accès réservé à l'Admin.</div>`;

  let html = `<div class="page-title">Gestion des comptes</div><div class="page-sub">Coachs, joueurs, bénévoles et autres comptes du club.</div>`;

  html += window.__showAddCompte
    ? renderAddCompteForm()
    : `<button class="add-toggle" id="gc-add-toggle">+ Ajouter un compte</button>`;

  COMPTE_ROLE_ORDER.forEach(role => {
    const rows = comptes.slice(1).filter(c => rowHasRole(c, role));
    if (rows.length === 0) return;
    html += `<div class="section-h">${COMPTE_ROLE_LABELS[role]} (${rows.length})</div>`;
    html += `<div class="compte-person-grid">`;
    rows.forEach(row => {
      const equipe = role === "Parent" ? rowEquipesForRole(row, "Parent")[0] : rowEquipesForRole(row, role)[0];
      html += renderComptePersonCard(row, role, equipe);
    });
    html += `</div>`;
  });

  return html;
}

// ===================== "AJOUTER MES JOUEURS" (auto-service Coach) =====================

function renderAjouterJoueursSheet() {
  const ctx = window.__showAjouterJoueurs;
  if (!ctx) return "";
  const added = window.__ajouterJoueursSession || [];

  return `<div class="sheet-overlay open" data-close-sheet="showAjouterJoueurs">
    <div class="sheet-scrim" data-close-sheet="showAjouterJoueurs"></div>
    <div class="sheet">
      <div class="sheet-close" data-close-sheet="showAjouterJoueurs">✕</div>
      <div class="sheet-grab"></div>
      <div class="sheet-hero">
        <div class="sheet-hero-eyebrow">${escapeHtml(teamDisplayLabel(ctx.equipe))}</div>
        <h2>Ajouter mes joueurs</h2>
        <p>Un nom à la fois — le joueur choisira son propre code à sa première connexion.</p>
      </div>
      <div class="sheet-body">
        <label class="field-label">Nom du joueur</label>
        <input id="aj-nom" type="text" placeholder="Nom du joueur" autocomplete="off" />
        ${window.__ajouterJoueursError ? `<div class="login-error">${escapeHtml(window.__ajouterJoueursError)}</div>` : ""}
        <div class="row-flex" style="margin-top:10px;">
          <button class="btn" style="flex:1;" id="aj-submit">Valider et ajouter un autre</button>
        </div>
        ${added.length > 0 ? `<div class="section-h" style="margin-top:16px;">Ajoutés (${added.length})</div>
          ${added.map(n => `<div class="sheet-row"><div><b>${escapeHtml(n)}</b></div></div>`).join("")}` : ""}
      </div>
    </div>
  </div>`;
}

// ===================== ACTIONS API =====================

// Optimiste : insère la ligne localement avant même la réponse serveur (même schéma que
// setupComptes : code vide, la personne le choisira à sa première connexion).
async function addCompteApi(nom, role, equipe) {
  comptes.push([nom, "", `${role}:${equipe}`, "", "", "", "", ""]);
  render();
  try {
    const params = new URLSearchParams({ action: "addCompte", nom, role, equipe, authNom: session.nom, authCode: session.code });
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();
    isOnline = true;
    return data;
  } catch (err) {
    isOnline = false;
    return { ok: false, error: "network" };
  }
}

function attachComptesEvents() {
  // ---------- "Ajouter mes joueurs" (Coach, depuis Profil) ----------
  document.querySelectorAll("[data-open-ajouter-joueurs]").forEach(el => {
    el.onclick = () => {
      vibrate();
      window.__showAjouterJoueurs = { equipe: el.dataset.openAjouterJoueurs };
      window.__ajouterJoueursSession = [];
      window.__ajouterJoueursError = "";
      render();
    };
  });

  const ajSubmit = document.getElementById("aj-submit");
  if (ajSubmit) ajSubmit.onclick = async () => {
    const input = document.getElementById("aj-nom");
    const nom = (input.value || "").trim();
    if (!nom) return;
    if (comptes.slice(1).some(c => c[0] === nom)) {
      window.__ajouterJoueursError = "Un compte porte déjà ce nom.";
      render();
      return;
    }
    window.__ajouterJoueursError = "";
    input.value = "";
    const ctx = window.__showAjouterJoueurs;
    const data = await addCompteApi(nom, "Joueur", ctx.equipe);
    if (data.ok) {
      window.__ajouterJoueursSession = [...(window.__ajouterJoueursSession || []), nom];
    } else {
      comptes = comptes.filter(c => c[0] !== nom); // annule l'ajout optimiste
      window.__ajouterJoueursError = data.error === "already_exists" ? "Un compte porte déjà ce nom." : "Impossible d'ajouter ce joueur. Réessaie.";
    }
    render();
  };

  // ---------- "Gestion des comptes" (Admin) ----------
  const gcAddToggle = document.getElementById("gc-add-toggle");
  if (gcAddToggle) gcAddToggle.onclick = () => {
    window.__showAddCompte = true;
    window.__addCompteRole = "Joueur";
    window.__addCompteError = "";
    render();
  };

  const acCancel = document.getElementById("ac-cancel");
  if (acCancel) acCancel.onclick = () => {
    window.__showAddCompte = false;
    window.__addCompteError = "";
    render();
  };

  const acRole = document.getElementById("ac-role");
  if (acRole) acRole.onchange = () => {
    window.__addCompteRole = acRole.value;
    render();
  };

  const acSubmit = document.getElementById("ac-submit");
  if (acSubmit) acSubmit.onclick = async () => {
    const nom = (document.getElementById("ac-nom").value || "").trim();
    const role = document.getElementById("ac-role").value;
    const equipeSelect = document.getElementById("ac-equipe");
    const enfantSelect = document.getElementById("ac-enfant");
    const equipe = role === "Parent" ? (enfantSelect ? enfantSelect.value : "") : (equipeSelect ? equipeSelect.value : "Toutes");

    if (!nom) { window.__addCompteError = "Merci de renseigner un nom."; render(); return; }
    if (role === "Parent" && !equipe) { window.__addCompteError = "Merci de choisir l'enfant rattaché."; render(); return; }
    if (comptes.slice(1).some(c => c[0] === nom)) { window.__addCompteError = "Un compte porte déjà ce nom."; render(); return; }

    window.__addCompteError = "";
    const data = await addCompteApi(nom, role, equipe);
    if (data.ok) {
      window.__showAddCompte = false;
    } else {
      comptes = comptes.filter(c => c[0] !== nom); // annule l'ajout optimiste
      window.__addCompteError = data.error === "already_exists" ? "Un compte porte déjà ce nom." : "Impossible de créer ce compte. Réessaie.";
    }
    render();
  };

  document.querySelectorAll("[data-open-compte-detail]").forEach(el => {
    el.onclick = () => {
      vibrate();
      const nom = el.dataset.openCompteDetail;
      const row = findCompteRow(nom);
      const equipe = row ? compteEquipeForPresence(row) : null;
      if (!equipe) { alert("Pas de présence liée à un événement d'équipe pour ce compte."); return; }
      window.__presenceDetailFor = { p: nom, equipe, monthOnly: false };
      render();
    };
  });
}
