# Tazi Pyjamas

Boutique de pyjamas en français et en arabe (RTL), interface responsive rose, crème et bordeaux. Panier persistant, choix de taille, filtres, favoris, commandes WhatsApp au **0663266817**, paiement à la livraison. Dashboard privé `/admin` pour les demandes et leur suivi via des identifiants configurés dans les variables serveur Netlify + Blobs.

```sh
npm ci
npm run dev
npm test
npm run build
```

Déploiement et réglages : [DEPLOYMENT.md](DEPLOYMENT.md). Catalogue de 55 fiches regroupant les 83 photos fournies, avec galeries, filtres et affichage progressif. Les prix restent entre 200 et 350 DH. Les photos originales sont conservées sans retouche, y compris les marques VS sur les vêtements. Le logo de la boutique Tazi est affiché séparément. Le backend se valide après déploiement Netlify.

Langues : bouton FR / العربية, choix conservé dans le navigateur. Les traductions sont dans `src/ar.js` ; la logique dans `src/i18n.js`. Les identifiants produits, tailles et statuts serveur restent identiques dans les deux langues.
