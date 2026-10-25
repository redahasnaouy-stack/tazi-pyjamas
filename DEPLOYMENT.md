# Tazi Pyjamas — déploiement

## Développement

Node 22 ou 24, `npm ci`, `npm run dev`. Production : `npm test && npm run build`.
Les fichiers à publier sont dans `dist/`. `netlify.toml` configure le build et les fonctions.

## Publier sur Netlify

1. Dans Netlify : Add new project → Import an existing project → GitHub → `redahasnaouy-stack/tazi-pyjamas`.
2. Branche `main`, commande `npm run build`, dossier `dist`, fonctions `netlify/functions`. Déployer.
3. Le panier et les demandes via WhatsApp fonctionnent sans configuration supplémentaire : **+212663266817**, paiement à la livraison. L'envoi WhatsApp est volontaire : le client confirme dans WhatsApp.
4. Pour enregistrer les demandes dans le dashboard, activer Netlify Identity (inscriptions sur invitation seulement), inviter le propriétaire et attribuer le rôle `admin` depuis les métadonnées d'application / rôles Identity. Ne jamais attribuer ce rôle depuis les métadonnées saisies par l'utilisateur.
5. Initialiser le mot de passe depuis l'invitation Identity. Ajouter si nécessaire le domaine de production aux URL autorisées et modèles d'email Identity. La connexion email/mot de passe est à `/admin`.
6. Vérifier Netlify Blobs sur ce site. Ajouter `ORDERS_ENABLED=true` dans les variables serveur Netlify et redéployer uniquement après validation des stocks, tailles, livraison, retours et traitement des données personnelles. La capture est désactivée par défaut, WhatsApp reste disponible.
7. Envoyer une demande test sur le site déployé et vérifier qu'elle apparaît dans `/admin`. Modifier son statut, se déconnecter puis vérifier qu'un visiteur non authentifié reçoit une erreur 401 sur GET `/.netlify/functions/orders`.

Les requêtes admin vérifient les jetons auprès de Netlify Identity et le rôle `admin`. Les données sont dans Netlify Blobs, pas dans le navigateur. Le total est recalculé côté serveur à partir du catalogue ; le prix transmis par un visiteur est ignoré. Aucune carte bancaire n'est collectée. Activer les protections anti-abus/rate limiting Netlify avant une ouverture publique importante. Le propriétaire doit définir ses conditions et sa durée de conservation des données, et supprimer les données de test via Netlify Blobs.

## Contenu et limites à valider

- Catalogue : 55 fiches regroupant les 83 photos du ZIP. Les vues du même modèle sont réunies en galerie. `data/image-manifest.json` relie chaque photo source à son produit et à son fichier WebP. Aucune photo source ne manque et aucune n’est comptée deux fois. Les noms et prix ont été proposés dans la fourchette demandée de 200 à 350 DH ; ils sont à valider avec le propriétaire.
- Les images publiées ont été retouchées/générées à partir des photos fournies. Les retouches demandées enlèvent les marques sur les vêtements et placent la marque Tazi hors du tissu. Vérifier les détails des images retouchées avec les articles réels avant la vente.
- Logo fourni par le propriétaire : version nettoyée du monogramme VS présent sur le vêtement du personnage. Les lettres Tazi Pyjamas, les couleurs et la composition sont conservées. Le logo est affiché hors des vêtements des produits.
- Tailles S à XL et disponibilité à confirmer avec le stock réel. Aucun stock physique synchronisé ni réservation automatique. Le dashboard gère les demandes et leurs statuts ; le catalogue se modifie dans `src/catalog.js`, pas depuis le dashboard pour cette version.
- Paiement à la livraison. Frais et délais de livraison à confirmer au client. Aucun tarif de livraison inventé.
- Pas encore de déploiement réel ni de validation du stockage et de l'authentification sur Netlify dans cette session. Le compte connecté dans le navigateur de l'utilisateur n'est pas exposé à l'agent.

## Vérifications

`npm test` : 7 tests couvrent les contacts, quantités, tailles, prix, le recalcul des totaux, la couverture des 83 photos et les paniers du catalogue complet. `npm run build` : bundle production.
Test navigateur local : collection, filtre, choix taille, panier et persistance, WhatsApp, message d'erreur si backend absent, mobile, écran de connexion admin.
Les services Identity et Blobs nécessitent la vérification sur le site Netlify déployé.
