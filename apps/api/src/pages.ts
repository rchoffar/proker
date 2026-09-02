// Static legal/support pages served by the API so the store listings have
// stable privacy-policy, support and account-deletion URLs without extra
// infrastructure. https://upk-api.fly.dev/privacy — /support — /account-deletion
// (/account-deletion is required by Google Play's Data safety form for apps
// with account creation.)

const CONTACT_EMAIL = 'froxyonfr@gmail.com';
const EFFECTIVE_DATE = '2026-09-01';

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0 auto; max-width: 42rem; padding: 2rem 1.25rem 4rem;
         font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  h1 { font-size: 1.6rem; margin-top: 0; }
  h2 { font-size: 1.2rem; margin-top: 2.5rem; }
  h3 { font-size: 1rem; }
  hr { border: none; border-top: 1px solid #8884; margin: 3rem 0; }
  small.muted { opacity: .7; }
  a { color: inherit; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export const privacyHtml: string = page(
  'UPK — Politique de confidentialité / Privacy Policy',
  `
<h1>UPK — Ultimate Poker Kit</h1>
<p><small class="muted">Politique de confidentialité / Privacy policy — en vigueur au / effective ${EFFECTIVE_DATE}</small></p>

<h2>🇫🇷 Politique de confidentialité</h2>

<h3>Qui sommes-nous</h3>
<p>UPK (Ultimate Poker Kit) est une application mobile de jeux de cartes poker gratuits entre amis (Bluff, OFC…), accompagnée d'outils pour les joueurs de poker : hand replayer, statistiques de jeu et programmes des festivals. Contact : <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>Données collectées</h3>
<p>L'utilisation d'UPK nécessite un compte, créé via « Se connecter avec Apple » ou « Se connecter avec Google ». Nous collectons uniquement :</p>
<ul>
  <li><strong>Adresse e-mail</strong> (fournie par Apple ou Google — avec Apple vous pouvez utiliser une adresse relais masquée) ;</li>
  <li><strong>Identifiant de compte</strong> (identifiant technique fourni par Apple/Google et un identifiant interne UPK) ;</li>
  <li><strong>Pseudo</strong> (choisi par vous, affiché aux autres joueurs dans les jeux en ligne) ;</li>
  <li><strong>Mains de poker que vous enregistrez</strong> dans le hand replayer (positions, blindes, tapis, actions) : elles sont sauvegardées sur votre appareil <em>et</em> synchronisées sur nos serveurs, rattachées à votre compte, afin que vous les retrouviez après une réinstallation ou sur un autre appareil. Vous seul y avez accès. Enregistrer une main est facultatif : l'application fonctionne sans.</li>
</ul>
<p>C'est tout. Pas de nom légal, pas de téléphone, pas de localisation, pas de contacts, pas de données financières.</p>

<h3>Utilisation</h3>
<p>Ces données servent exclusivement au fonctionnement de l'application : maintenir votre session, vous identifier dans les jeux en ligne (par votre pseudo), synchroniser les mains que vous enregistrez et vous permettre de retrouver votre compte. Elles ne sont <strong>jamais</strong> vendues, partagées avec des tiers, ni utilisées à des fins publicitaires ou de profilage.</p>

<h3>Pas de suivi ni de publicité</h3>
<p>UPK ne contient <strong>aucun</strong> SDK publicitaire, d'analytique ou de suivi (tracking). Aucune donnée n'est utilisée pour vous suivre entre applications ou sites web.</p>

<h3>Données stockées sur votre appareil</h3>
<p>Vos <strong>statistiques de jeu</strong> (parties jouées, victoires, records, par pseudo) et vos <strong>préférences</strong> sont stockées <strong>uniquement sur votre appareil</strong> et ne sont jamais transmises à nos serveurs. Vos mains enregistrées y sont également conservées, en plus de la copie synchronisée sur nos serveurs décrite ci-dessus. Le jeton de session est stocké dans le stockage sécurisé du système (Keychain).</p>

<h3>Hébergement et conservation</h3>
<p>Les données de compte et les mains synchronisées sont hébergées sur Fly.io. Elles sont conservées tant que votre compte existe.</p>

<h3>Suppression de votre compte</h3>
<p>Vous pouvez supprimer votre compte à tout moment depuis l'application (Profil → Supprimer le compte). La suppression est immédiate et définitive : toutes les données serveur associées (e-mail, identifiants, pseudo, mains synchronisées) sont effacées. Vous pouvez aussi en faire la demande par e-mail à <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>Vos droits</h3>
<p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de portabilité et d'effacement de vos données. Écrivez-nous à <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>Mineurs</h3>
<p>UPK est destiné aux adultes (18+). L'application ne propose aucun jeu d'argent réel : aucune mise, aucun gain, aucun lien vers des opérateurs de jeux d'argent.</p>

<hr>

<h2>🇬🇧 Privacy Policy</h2>

<h3>Who we are</h3>
<p>UPK (Ultimate Poker Kit) is a mobile app of free poker card games to play with friends (Bluff, OFC…), bundled with tools for poker players: a hand replayer, game stats and festival schedules. Contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>Data we collect</h3>
<p>Using UPK requires an account, created via “Sign in with Apple” or “Sign in with Google”. We collect only:</p>
<ul>
  <li><strong>Email address</strong> (provided by Apple or Google — with Apple you may use a private relay address);</li>
  <li><strong>Account identifier</strong> (a technical ID from Apple/Google plus an internal UPK ID);</li>
  <li><strong>Nickname</strong> (chosen by you, shown to other players in online games);</li>
  <li><strong>The poker hands you save</strong> in the hand replayer (positions, blinds, stacks, actions): they are stored on your device <em>and</em> synced to our servers under your account, so you keep them after a reinstall or on another device. Only you can access them. Saving a hand is optional — the app works without it.</li>
</ul>
<p>That's all. No legal name, no phone number, no location, no contacts, no financial data.</p>

<h3>How we use it</h3>
<p>This data is used solely to operate the app: keeping your session alive, identifying you in online games (by nickname), syncing the hands you save, and letting you recover your account. It is <strong>never</strong> sold, shared with third parties, or used for advertising or profiling.</p>

<h3>No tracking, no ads</h3>
<p>UPK contains <strong>no</strong> advertising, analytics, or tracking SDKs. No data is used to track you across apps or websites.</p>

<h3>Data stored on your device</h3>
<p>Your <strong>game stats</strong> (games played, wins, records, per nickname) and <strong>preferences</strong> are stored <strong>on your device only</strong> and are never sent to our servers. Your saved hands are also kept there, in addition to the synced copy on our servers described above. Your session token is kept in the system secure storage (Keychain).</p>

<h3>Hosting and retention</h3>
<p>Account data and synced hands are hosted on Fly.io and retained for as long as your account exists.</p>

<h3>Deleting your account</h3>
<p>You can delete your account at any time from within the app (Profile → Delete account). Deletion is immediate and permanent: all associated server data (email, identifiers, nickname, synced hands) is erased. You can also request deletion by email at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>Your rights</h3>
<p>Under the GDPR you have the right to access, rectify, port, and erase your data. Write to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>Minors</h3>
<p>UPK is intended for adults (18+). The app offers no real-money gambling: no wagering, no payouts, no links to gambling operators.</p>
`,
);

export const supportHtml: string = page(
  'UPK — Support',
  `
<h1>UPK — Ultimate Poker Kit</h1>
<p><small class="muted">Support</small></p>

<h2>🇫🇷 Aide</h2>
<p>UPK est une collection de jeux de cartes poker gratuits entre amis (Bluff, OFC, flip…), accompagnée d'outils pour les joueurs : replayer de mains, statistiques de jeu et programmes des festivals.</p>
<h3>Questions fréquentes</h3>
<ul>
  <li><strong>Ai-je besoin d'un compte ?</strong> Oui — la connexion (Apple ou Google) est requise. La création est gratuite et immédiate, sans formulaire ni mot de passe.</li>
  <li><strong>Comment supprimer mon compte ?</strong> Profil → Supprimer le compte. Effet immédiat et définitif.</li>
  <li><strong>UPK est-il un site de jeux d'argent ?</strong> Non. Aucune mise en argent réel, aucun gain — les jeux sont purement récréatifs.</li>
  <li><strong>Mes données sont-elles envoyées en ligne ?</strong> Vos statistiques de jeu et vos préférences restent sur votre appareil. Les mains que vous enregistrez dans le replayer sont synchronisées sur votre compte, pour que vous les retrouviez après une réinstallation — vous seul y avez accès.</li>
</ul>
<p>Un problème, une suggestion ? Écrivez-nous : <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Nous répondons généralement sous 48 h.</p>

<hr>

<h2>🇬🇧 Help</h2>
<p>UPK is a collection of free poker card games to play with friends (Bluff, OFC, flip…), bundled with player tools: a hand replayer, game stats and festival schedules.</p>
<h3>FAQ</h3>
<ul>
  <li><strong>Do I need an account?</strong> Yes — signing in (Apple or Google) is required. Creation is free and instant, with no forms or passwords.</li>
  <li><strong>How do I delete my account?</strong> Profile → Delete account. Immediate and permanent.</li>
  <li><strong>Is UPK a gambling app?</strong> No. No real-money wagering, no payouts — the games are purely recreational.</li>
  <li><strong>Is my data uploaded?</strong> Your game stats and preferences stay on your device. The hands you save in the replayer are synced to your account so you keep them after a reinstall — only you can access them.</li>
</ul>
<p>Problems or suggestions? Email us: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We usually reply within 48 hours.</p>

<p><a href="/privacy">Politique de confidentialité / Privacy policy</a> · <a href="/account-deletion">Suppression de compte / Account deletion</a></p>
`,
);

export const accountDeletionHtml: string = page(
  'UPK — Suppression de compte / Account deletion',
  `
<h1>UPK — Ultimate Poker Kit</h1>
<p><small class="muted">Suppression de compte / Account deletion</small></p>

<h2>🇫🇷 Supprimer votre compte UPK</h2>
<p>Vous pouvez supprimer votre compte à tout moment, directement dans l'application :</p>
<ol>
  <li>Ouvrez UPK et allez dans l'onglet <strong>Profil</strong> ;</li>
  <li>Touchez <strong>Supprimer le compte</strong> et confirmez.</li>
</ol>
<p>La suppression est <strong>immédiate et définitive</strong> : toutes les données serveur associées à votre compte (adresse e-mail, identifiants, pseudo, mains synchronisées) sont effacées, dans la même opération. Les données stockées localement sur votre appareil (mains enregistrées, statistiques de jeu, préférences) sont supprimées lorsque vous désinstallez l'application.</p>
<p>Vous ne pouvez plus accéder à l'application ? Envoyez votre demande de suppression par e-mail à <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> depuis l'adresse associée à votre compte — nous la traitons sous 30 jours (généralement sous 48 h).</p>

<hr>

<h2>🇬🇧 Delete your UPK account</h2>
<p>You can delete your account at any time, directly in the app:</p>
<ol>
  <li>Open UPK and go to the <strong>Profile</strong> tab;</li>
  <li>Tap <strong>Delete account</strong> and confirm.</li>
</ol>
<p>Deletion is <strong>immediate and permanent</strong>: all server data associated with your account (email address, identifiers, nickname, synced hands) is erased in a single operation. Data stored locally on your device (saved hands, game stats, preferences) is removed when you uninstall the app.</p>
<p>Can't access the app anymore? Email your deletion request to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> from the address associated with your account — we process it within 30 days (usually within 48 hours).</p>

<p><a href="/privacy">Politique de confidentialité / Privacy policy</a> · <a href="/support">Support</a></p>
`,
);
