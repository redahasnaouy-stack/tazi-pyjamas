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

Les données sont dans Netlify Blobs. Les prix sont recalculés côté serveur. Les demandes WhatsApp ne sont pas ajoutées automatiquement au dashboard. Les demandes WhatsApp peuvent être saisies manuellement dans l’onglet Commandes. Le propriétaire définit la durée de conservation et gère ses sauvegardes privées.

## Contenu et limites à valider

- Catalogue : 55 fiches regroupant les 83 photos du ZIP. Les vues du même modèle sont réunies en galerie. `data/image-manifest.json` relie chaque photo source à son produit et à son fichier JPEG original. Aucune photo source ne manque et aucune n’est comptée deux fois. Les noms et prix ont été proposés dans la fourchette demandée de 200 à 350 DH ; ils sont à valider avec le propriétaire.
- À la demande du propriétaire, les 83 photos produits sont désormais des fichiers JPEG originaux, copiés sans retouche, recadrage, recompression ni génération. Les marques VS et Victoria’s Secret présentes dans les photos sont conservées. 31 fichiers viennent du dernier ZIP « WhatsApp Unknown 2026-10-25 at 13.40.44.zip », les autres du ZIP « pyjamas.zip ». Les empreintes SHA-256 de `data/image-manifest.json` permettent de vérifier les fichiers publiés. Le logo Tazi est une couche d’affichage séparée ; il n’est pas incorporé aux vêtements ou aux fichiers originaux.
- Logo fourni par le propriétaire : version nettoyée du monogramme VS présent sur le vêtement du personnage. Les lettres Tazi Pyjamas, les couleurs et la composition sont conservées. Le logo est affiché hors des vêtements des produits.
- Tailles S à XL et disponibilité à confirmer avec le stock réel. Le stock initial est non renseigné (cases vides). Le propriétaire renseigne les quantités réelles et les tailles dans le dashboard. Une confirmation réserve le stock suivi ; une annulation ou un retour enregistré le restitue. La gestion ne synchronise aucun entrepôt externe.
- Paiement à la livraison. Frais et délais de livraison à confirmer au client. Aucun tarif de livraison inventé.
- Pas encore de déploiement réel ni de validation du stockage et de l'authentification sur Netlify dans cette session. Le compte connecté dans le navigateur de l'utilisateur n'est pas exposé à l'agent.

## Vérifications

`npm test` : tests métier et sécurité couvrent les contacts, quantités, tailles, prix, le recalcul des totaux, la couverture des 83 photos et les paniers du catalogue complet, ainsi que la connexion, les sessions administrateur et la conservation exacte des JPEG originaux. `npm run build` : bundle production.
Test navigateur local : collection, filtre, choix taille, panier et persistance, WhatsApp, message d'erreur si backend absent, mobile, écran de connexion admin.
Les variables serveur et Netlify Blobs nécessitent une vérification sur le site Netlify déployé.

`node scripts/admin-browser-check.mjs` : test du vrai gestionnaire de connexion (identifiants de test isolés), cookie HttpOnly, rechargement et déconnexion ; le stockage des commandes est simulé pour ce test local. Le serveur de prévisualisation doit tourner sur le port 4173.

## Langue arabe

La boutique et le dashboard proposent FR / العربية. La préférence est enregistrée sous `tazi-language` et applique `lang=ar` / `dir=rtl`. Produits, couleurs, filtres, panier, formulaire, messages et textes WhatsApp sont traduits ; les photos originales restent inchangées. Les valeurs des API (identifiants, tailles, statuts) ne sont pas traduites. Les numéros de téléphone acceptent les chiffres arabes et persans, normalisés côté serveur.

`node scripts/arabic-browser-check.mjs` teste le parcours arabe, la persistance de la langue et du panier, le mobile, WhatsApp, une commande avec coordonnées arabes et les statuts du dashboard. L’authentification et le stockage sont simulés dans ce test de langue ; le vrai gestionnaire de connexion est testé séparément.

## Administration complète

- **Vue d’ensemble** : périodes 7/30/90 jours ou historique complet, demandes, chiffre d’affaires des produits livrés, encaissements déclarés, alertes de stock, meilleures ventes et journal récent. Les montants proviennent des commandes enregistrées ; aucune donnée de démonstration n’est installée.
- **Commandes** : recherche, filtres statut/paiement/dates (calendrier Casablanca), saisie manuelle Site/WhatsApp, coordonnées, notes internes, transporteur et référence de suivi, frais, historique, CSV et impression d’un bon de commande. Le bon ne constitue pas une facture fiscale. Aucun transporteur n’est interrogé automatiquement.
- **Produits & stock** : création et modification en français/arabe, prix de 200 à 350 DH, couleurs, catégories, tailles, quantités disponibles, visibilité/archivage réversible, galerie et couverture, upload JPEG/PNG/WebP (3 Mo, 8 photos). Les octets des photos sont conservés sans retouche. Un stock vide signifie « non suivi », un zéro signifie indisponible.
- **Clients** : regroupement des commandes par téléphone marocain normalisé, historique et encaissements, recherche et export CSV. Les exports protègent contre les formules de tableur.
- **Paramètres** : contact WhatsApp, email public, annonces bilingues, tarifs par ville, frais par défaut, seuil d’alerte et suspension des demandes. Les demandes du site nécessitent également `ORDERS_ENABLED=true`. Sans tarif, les frais restent à confirmer. La sauvegarde JSON contient des données privées, jamais les mots de passe.

### Stock et paiements

Une nouvelle demande ne réserve rien. Le stock disponible suivi est réservé lors du passage à **Confirmée**, avec contrôle atomique pour éviter une double réservation du dernier article. Parcours : Nouvelle → Confirmée → Expédiée → Livrée → Retournée ; Nouvelle/Confirmée peuvent être annulées, puis réouvertes. Une annulation ou un retour ne restitue les quantités réservées qu’une seule fois. Le paiement (En attente / Payé / Remboursé) reste une déclaration indépendante : ni encaissement ni remboursement bancaire n’est réalisé par l’application. Les prix des articles restent ceux enregistrés à la création du bon.

Les modifications périmées sont refusées (409) au lieu d’écraser une modification concurrente. Actualisez et reprenez la modification. Les anciennes sessions sont toujours protégées par les mêmes variables `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.

### Stockage et migration

`tazi-shop/state` est l’état opérationnel durable (catalogue, paramètres, commandes, activité). Les écritures utilisent les ETags conditionnels Netlify Blobs et des lectures fortement cohérentes. Les anciennes commandes `tazi-orders` sont importées sans effacement ; une période de grâce et une dernière lecture récupèrent les écritures encore en vol de l’ancien déploiement. Une commande déjà modifiée dans le nouvel admin reste prioritaire. Les nouveaux médias sont dans `tazi-media`, servis publiquement comme images, tandis que commandes et stocks détaillés restent privés.

Le format transactionnel agrégé vise une petite boutique : maximum 500 produits, 5 000 commandes et 3 Mo d’état JSON (la première limite atteinte s’applique). Au-delà, prévoir un archivage et un stockage paginé dédiés. Les événements d’activité sont limités aux 200 derniers et l’historique d’une commande aux 100 derniers ; les commandes elles-mêmes ne sont pas supprimées automatiquement. Les déploiements ne réinitialisent pas ce stockage. `src/catalog.js` sert à l’initialisation, pas à écraser les modifications enregistrées.

### Validation locale et après déploiement

`npm test` vérifie validation, migration, contrôles d’accès, concurrence du stock, retours, paiements, prix historiques, tarifs, CSV et dates. `npm run build` produit le site et le module admin séparé.

Avec `npm run preview -- --port 4173` démarré :

```sh
node scripts/dashboard-browser-check.mjs
node scripts/admin-browser-check.mjs
node scripts/arabic-browser-check.mjs
TAZI_BASE_URL=http://localhost:4173 node scripts/browser-check.mjs
```

Le test complet crée un serveur local sur 4180 (4181 pour le test de session), utilise les vrais gestionnaires HTTP/authentification/métier et remplace uniquement le fournisseur Blob par un adaptateur en mémoire. Il teste uploads exacts, publication de produits, frais, commande depuis la boutique, réservation, expédition, paiement, retour, commandes manuelles, CSV, archivage, rechargement, arabe/mobile, sauvegarde et déconnexion. Il n’envoie aucun message WhatsApp. Ces tests ne prouvent pas l’accès au stockage du site Netlify réel.

Après le déploiement, se connecter, configurer les stocks et frais réels, enregistrer une modification puis recharger dans un second onglet, envoyer une demande test, vérifier la réservation/annulation et sauvegarder. Vérifier le refus 401 de `/.netlify/functions/shop?admin=1` sans session. Ne pas supprimer `tazi-shop` ou `tazi-media` pendant une opération normale.
