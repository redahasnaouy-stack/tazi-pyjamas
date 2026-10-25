# Tazi Pyjamas

Boutique de pyjamas en français et en arabe (RTL), interface responsive rose, crème et bordeaux. Panier persistant, choix de taille, filtres, favoris, commandes WhatsApp au **0663266817**, paiement à la livraison. Dashboard privé `/admin` : statistiques, commandes, produits et stocks par taille, clients, tarifs de livraison, exports CSV, sauvegarde JSON et bons de commande. Les données sont conservées dans Netlify Blobs ; l’accès utilise les identifiants des variables serveur Netlify.

```sh
npm ci
npm run dev
npm test
npm run build
```

Déploiement et réglages : [DEPLOYMENT.md](DEPLOYMENT.md). Catalogue initial de 55 fiches regroupant les 83 photos fournies, avec galeries, filtres et affichage progressif. Les prix restent entre 200 et 350 DH. Les photos originales sont conservées sans retouche, y compris les marques VS sur les vêtements. Le logo de la boutique Tazi est affiché séparément. Le backend se valide après déploiement Netlify.

Langues : bouton FR / العربية, choix conservé dans le navigateur. Les traductions sont dans `src/ar.js` ; la logique dans `src/i18n.js`. Les identifiants produits, tailles et statuts serveur restent identiques dans les deux langues.

Gestion quotidienne : ouvrez `/admin` pour modifier le catalogue opérationnel. `src/catalog.js` sert uniquement de catalogue initial ; les modifications du dashboard sont sauvegardées côté serveur et ne sont pas écrasées par un déploiement. Voir les règles de stock, les tests et la migration dans [DEPLOYMENT.md](DEPLOYMENT.md).
