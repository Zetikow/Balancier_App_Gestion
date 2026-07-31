// ===================================================================
// CONFIGURATION FIREBASE (notifications push)
// ===================================================================
// Config du projet Firebase (console.firebase.google.com > Paramètres du projet > Général >
// Vos applications > appli Web). Ces valeurs ne sont pas secrètes — Firebase les considère
// publiques par conception, la sécurité se fait via les règles Firebase, pas en les cachant.
//
// FCM_VAPID_KEY : Paramètres du projet > Cloud Messaging > Configuration Web > Certificats Web
// Push > "Générer une paire de clés". Clé PUBLIQUE elle aussi, sans risque à exposer côté client.
//
// Ce même bloc firebaseConfig doit aussi être collé dans sw.js (les service workers ne peuvent
// pas importer les fichiers JS de la page principale) — pense à mettre à jour les deux si tu
// recrées le projet Firebase.
// ===================================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAVIQ_gg_QTHW6j_3j4Y4kH77x3m0uGmgs",
  authDomain: "appgestionclubly.firebaseapp.com",
  projectId: "appgestionclubly",
  storageBucket: "appgestionclubly.firebasestorage.app",
  messagingSenderId: "23626038152",
  appId: "1:23626038152:web:2e863fe7c9a9fe9fd4d83d",
};

const FCM_VAPID_KEY = "BLdZaLBugmlIUikMZx05e00lyuwoxRHwijRMceAK9jgYvStJch6OPgc17Ww5DeXwjLS6ma7XNjUmuDhInyOFHn8";
