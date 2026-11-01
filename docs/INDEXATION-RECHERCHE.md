# Faire apparaître Ride For Brains dans les recherches

## Vérification du 1er novembre 2026

Le domaine public `https://rideforbrains.ca/` répond HTTP 200, avec une balise `index, follow` et une adresse canonical vers ce même domaine. `robots.txt` répond HTTP 200 et autorise les pages publiques; il annonce `https://rideforbrains.ca/sitemap.xml`, qui répond HTTP 200 avec les pages et les cinq activités. Aucun blocage général d’indexation n’a été observé lors de cette vérification.

Ce contrôle ne prouve pas que Google ou Bing ont déjà indexé le site. Seul le rapport de leur outil propriétaire permet de connaître les motifs précis pour une URL. La nouvelle version locale améliore aussi les métadonnées et évite la répétition du nom dans le titre de l’accueil, mais elle n’a pas été déployée.

## Google, étape par étape

1. Ouvrir [Google Search Console](https://search.google.com/search-console/) avec son compte Google.
2. Ajouter une propriété de type **Domaine** et saisir `rideforbrains.ca`, sans protocole ni chemin.
3. Copier l’enregistrement TXT de vérification fourni par Google. Ne pas inventer sa valeur.
4. Dans Cloudflare, ouvrir le domaine → **DNS → Records → Add record**.
5. Choisir **TXT**, nom **@**, contenu égal à la valeur complète `google-site-verification=…` fournie par Google, TTL **Auto**, puis enregistrer. Conserver les autres enregistrements du site et des courriels.
6. Revenir dans Search Console et cliquer sur **Valider**. Attendre la propagation si Google ne le voit pas encore. Garder cet enregistrement après la validation.
7. Dans **Sitemaps**, envoyer `https://rideforbrains.ca/sitemap.xml`.
8. Dans **Inspection de l’URL**, saisir `https://rideforbrains.ca/`, consulter le résultat, tester l’URL en direct si nécessaire, puis **Demander une indexation**.
9. Refaire l’inspection pour les pages d’activités principales seulement si utile. Si Google signale un refus, conserver le motif exact : « découvert », « exploré non indexé », blocage, erreur d’accès ou autre. Il faut traiter ce motif; répéter la demande en boucle n’accélère pas le passage.

La validation de domaine utilise les DNS : [aide officielle Search Console](https://support.google.com/webmasters/answer/9008080?hl=fr). Les demandes d’exploration peuvent prendre plusieurs jours ou semaines, sans garantie d’inclusion immédiate : [documentation Google](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl?hl=fr). Un sitemap favorise la découverte mais ne garantit ni indexation ni classement : [guide des sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview).

## Bing et la barre de recherche du navigateur

La barre du navigateur utilise le moteur choisi dans ses paramètres. Si les résultats viennent de Bing, ajouter le domaine dans [Bing Webmaster Tools](https://www.bing.com/webmasters/), puis importer la propriété déjà validée de Search Console ou effectuer la validation proposée. Envoyer le même sitemap. [Instructions officielles Bing](https://www2.bing.com/webmasters/help/add-and-verify-site-12184f8b).

Ajouter aussi le lien du site aux pages officielles de Ride For Brains et aux communications publiques pertinentes aide les visiteurs et les moteurs à le découvrir. Utiliser des informations exactes et des liens authentiques; aucun achat de liens ni faux avis n’est nécessaire.

Les comptes Search Console/Bing, la validation de propriété et l’envoi du sitemap ne sont pas effectués automatiquement par le déploiement GitHub/Cloudflare. Aucun de ces comptes ou réglages externes n’a été créé ou modifié pendant la recette.
