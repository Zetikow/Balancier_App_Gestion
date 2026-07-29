// ===================================================================
// CONFIG DU CLUB — seul fichier (avec Config.gs côté backend) à modifier
// pour adapter le frontend à une autre association : barème, effectif,
// nom d'équipe, salle, liens externes.
//
// BALANCIER : app-modèle de démonstration (club et effectif fictifs) —
// voir apps-script/Setup.gs pour le script qui peuple les fausses données.
// ===================================================================

// ATTENTION : ce barème doit rester identique à ACTIONS dans apps-script/Config.gs
// (source de vérité côté serveur) — à mettre à jour des deux côtés en même temps.
const ACTIONS = [
  ["participation mensuelle", 5],
  ["Retard entraînement", 1],
  ["Retard match", 1],
  ["Absence non justifié à l'entrainement", 10],
  ["Oubli de vêtement entraînement", 3],
  ["Oubli de vêtement match", 6],
  ["Absence non justifié au match", 50],
  ["Oubli de chasuble", 2],
  ["Taxer une serviette de douche", 2],
  ["Taxer du savon", 1],
  ["Taxer de la crème", 0.5],
  ["Carton Rouge direct", 7],
  ["2min pour avoir râler", 4],
  ["Carton bleu", 15],
  ["Pas de logo du club pour le déplacement", 5],
  ["Ballon dégueulasse (vraiment !)", 2],
  ["Oubli du ballon (match / entrainement)", 2],
  ["Taxer de l'eau", 1],
  ["Pas présent repas après match domicile", 5],
  ["Nom dans le journal", 2],
  ["Photo dans le journal", 4],
  ["Pire action du match (+ déguisement)", 1],
  ["Meilleure action du match", 2],
  ["Autre (à préciser)", 1],
];

// Effectif fictif SM1 (démonstration) — prénoms inventés uniquement, jamais de nom de
// famille, chacun marqué "(fictif)". Doit rester identique à PLAYERS dans apps-script/Config.gs.
const PLAYERS = ["Antoine (fictif)","Baptiste (fictif)","Cyril (fictif)","Dorian (fictif)","Enzo (fictif)","Fabien (fictif)","Gaspard (fictif)","Hugo (fictif)","Ilan (fictif)","Jonas (fictif)","Kevin (fictif)","Loïc (fictif)","Maxime (fictif)","Noé (fictif)","Oscar (fictif)","Paul (fictif)","Quentin (fictif)","Rémi (fictif)","Simon (fictif)","Tristan (fictif)"];

// Pas de vrai compte PayPal pour une app de démonstration.
const PAYPAL_ME_USERNAME = "";
const TEAMS = ["SM1", "U17M1", "U13M1"];

// Libellé affiché pour une équipe, si différent de son identifiant interne. Vide pour l'instant.
const TEAM_DISPLAY_LABELS = {};
function teamDisplayLabel(equipe) { return TEAM_DISPLAY_LABELS[equipe] || equipe; }

// Brûlage : nombre max de matchs avant de ne plus pouvoir redescendre dans l'équipe inférieure.
// SM1 se base sur la Sélection match (feuille "Selections", pas de composition publiée pour
// cette équipe) ; U17M1 se base sur la composition publiée (comme avant), voir composition.js.
// U13M1 n'est pas concernée (trop jeune pour être appelée en équipe supérieure).
const BRULAGE_MAX_MATCHES_SM1 = 11;
const BRULAGE_MAX_MATCHES_U17M1 = 10;

// Nombre de places pour la sélection d'un match (compteur "x/12" affiché sur la carte).
const SELECTION_MAX_PLAYERS = 12;

// Adresse mail de relance visible sur Profil/Accueil pour permettre aux joueurs de la renseigner.
const EMAIL_REMINDER_UI_VISIBLE = true;

// Pas de widget Score'n'co pour une app de démonstration — laissés vides, la carte ne
// s'affiche simplement pas.
const SCORENCO_WIDGET_IDS = {
  SM1: "",
  U17M1: "",
  U13M1: "",
};
// Nom affiché sur le widget Score'n'co le temps qu'il charge.
const SCORENCO_CLUB_LABEL = "Balancier";

// Nom court de l'équipe/du club utilisé partout où on affiche le nom (cartes de match,
// formulaire de création d'événement...). Club fictif de démonstration.
const CLUB_TEAM_NAME = "Balancier";
// Reconnaît le nom complet du club dans un titre de match pour en extraire l'adversaire.
const CLUB_FULL_NAME_PATTERN = /balancier/gi;
const CLUB_SHORT_NAME_PATTERN = /balancier/gi;

// Mot-clé (en minuscules) présent dans le nom de la salle du club, pour détecter si un match
// est à domicile ou à l'extérieur à partir du lieu renseigné.
const HOME_VENUE_KEYWORD = "balancier";
// Nom complet de la salle, utilisé comme valeur par défaut dans les formulaires.
const DEFAULT_VENUE_NAME = "Salle du Balancier";

// Pas de site web réel pour une app de démonstration.
const CLUB_WEBSITE_URL = "";
