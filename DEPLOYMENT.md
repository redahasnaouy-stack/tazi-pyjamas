# Tazi Pyjamas — déploiement

## Développement

Node 22 ou 24, `npm ci`, `npm run dev`. Production : `npm test && npm run build`.
Les fichiers à publier sont dans `dist/`. `netlify.toml` configure le build et les fonctions.

## Publier sur Netlify

1. Dans Netlify : Add new project → Import an existing project → GitHub → `redahasnaouy-stack/tazi-pyjamas`.
2. Branche `main`, commande `npm run build`, dossier `dist`, fonctions `netlify/functions`. Déployer.
3. Le panier et les demandes via WhatsApp fonctionnent sans configuration supplémentaire : **+212663266817**, paiement à la livraison. L'envoi WhatsApp est volontaire : le client confirme dans WhatsApp.
4. Dans **Project configuration → Environment variables**, ajouter ces variables pour le contexte Production, avec une portée **Functions** (ou toutes les portées si votre offre ne permet pas de choisir) :

| Variable | Valeur à saisir dans Netlify |
| --- | --- |
| `ADMIN_EMAIL` | Votre adresse email de connexion |
| `ADMIN_PASSWORD` | Un mot de passe unique d’au moins 16 caractères |
| `ADMIN_SESSION_SECRET` | Une valeur aléatoire indépendante d’au moins 32 caractères, générée par un gestionnaire de mots de passe |
| `ORDERS_ENABLED` | `true` pour activer la réception des demandes, après validation des conditions de vente |

5. Relancer le déploiement après enregistrement des variables, puis ouvrir `/admin` et utiliser `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Aucun compte Identity ni invitation n’est nécessaire. Ne jamais utiliser de préfixe `VITE_` pour ces variables : elles doivent rester côté serveur. Ne pas mettre leurs valeurs dans Git, le chat ou le fichier `netlify.toml`.
6. Vérifier Netlify Blobs sur ce site, envoyer une demande test et vérifier sa présence dans `/admin`. Modifier son statut puis se déconnecter. Un visiteur non connecté doit recevoir 401 sur GET `/.netlify/functions/orders`.

Les identifiants sont vérifiés côté serveur. La session utilise un cookie signé **HttpOnly, Secure, SameSite=Strict**, valable 4 heures ; aucun jeton n’est stocké dans localStorage ou sessionStorage. Les requêtes de connexion, déconnexion et changement de statut vérifient l’origine. La fonction d’authentification déclare une limite Netlify de 10 requêtes par minute et par IP/domaine. Une modification du mot de passe ou du secret invalide les sessions existantes. La déconnexion efface le cookie du navigateur ; en cas de compromission, changer le mot de passe et redéployer pour invalider toutes les sessions.

Les données sont dans Netlify Blobs. Les prix sont recalculés côté serveur. Les demandes WhatsApp ne sont pas ajoutées automatiquement au dashboard. Le propriétaire définit la durée de conservation et supprime les données de test via Netlify Blobs.

## Contenu et limites à valider

- Catalogue : 55 fiches regroupant les 83 photos du ZIP. Les vues du même modèle sont réunies en galerie. `data/image-manifest.json` relie chaque photo source à son produit et à son fichier WebP. Aucune photo source ne manque et aucune n’est comptée deux fois. Les noms et prix ont été proposés dans la fourchette demandée de 200 à 350 DH ; ils sont à valider avec le propriétaire.
- Les images publiées ont été retouchées/générées à partir des photos fournies. Les retouches demandées enlèvent les marques sur les vêtements et placent la marque Tazi hors du tissu. Vérifier les détails des images retouchées avec les articles réels avant la vente.
- Logo fourni par le propriétaire : version nettoyée du monogramme VS présent sur le vêtement du personnage. Les lettres Tazi Pyjamas, les couleurs et la composition sont conservées. Le logo est affiché hors des vêtements des produits.
- Tailles S à XL et disponibilité à confirmer avec le stock réel. Aucun stock physique synchronisé ni réservation automatique. Le dashboard gère les demandes et leurs statuts ; le catalogue se modifie dans `src/catalog.js`, pas depuis le dashboard pour cette version.
- Paiement à la livraison. Frais et délais de livraison à confirmer au client. Aucun tarif de livraison inventé.
- Pas encore de déploiement réel ni de validation du stockage et de l'authentification sur Netlify dans cette session. Le compte connecté dans le navigateur de l'utilisateur n'est pas exposé à l'agent.

## Vérifications

`npm test` : 8 tests couvrent les contacts, quantités, tailles, prix, le recalcul des totaux, la couverture des 83 photos et les paniers du catalogue complet, ainsi que la connexion et les sessions administrateur. `npm run build` : bundle production.
Test navigateur local : collection, filtre, choix taille, panier et persistance, WhatsApp, message d'erreur si backend absent, mobile, écran de connexion admin.
Les variables serveur et Netlify Blobs nécessitent une vérification sur le site Netlify déployé.

`node scripts/admin-browser-check.mjs` : test du vrai gestionnaire de connexion (identifiants de test isolés), cookie HttpOnly, rechargement et déconnexion ; le stockage des commandes est simulé pour ce test local. Le serveur de prévisualisation doit tourner sur le port 4173.
