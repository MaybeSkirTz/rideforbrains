# Cartes des parcours GPX

Chaque page d’activité affiche les coordonnées du GPX déjà enregistré sur un fond de carte OpenStreetMap. La vue initiale et le bouton **Recentrer le parcours** utilisent les limites de ce tracé, jamais une ville prédéfinie. Le fond montre les routes, leurs noms, les localités et les cours d’eau. Il n’invente aucun trajet et ne recalcule pas l’itinéraire sur le réseau routier.

Les boutons +/−, le déplacement tactile ou à la souris et le clavier permettent d’examiner les rues. Le départ et l’arrivée correspondent aux premier et dernier points publiés; les repères ajoutés dans l’administration sont conservés. L’attribution OpenStreetMap et l’échelle restent visibles. Si les images de carte sont indisponibles, le tracé reste affiché avec un bouton pour réessayer le chargement.

Les cinq GPX existants sont repris automatiquement après publication. Pour en remplacer un : **Administration → Événement → activité → Tracé officiel**, importer le nouveau fichier puis enregistrer l’activité. Le lien de téléchargement du GPX reste distinct. Il n’y a pas de clé cartographique à créer ni de changement D1, R2, Stripe ou Resend à effectuer pour cette carte.

Sur mobile, un bouton **Se connecter / S’inscrire** apparaît sous l’en-tête sans ouvrir le menu. Il devient **Mon espace** lorsque la personne est connectée.

Leaflet est livré avec le code du site, sans script de carte externe. Les images du fond sont demandées directement à OpenStreetMap avec les en-têtes de cache normaux du navigateur; aucun préchargement de zone ni téléchargement hors ligne n’est ajouté. La page Confidentialité indique ce chargement externe. Références : [documentation Leaflet](https://leafletjs.com/reference.html), [politique des fonds OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).

La recette locale utilise une copie en lecture seule des cinq tracés publics existants (1 466, 228, 110, 75 et 110 points). Aucun tracé fictif n’est ajouté au site de production. Les données du site en ligne ne sont pas modifiées par cette recette.

Pour publier, suivre [la mise à jour du site existant](MISE-A-JOUR-SITE-EXISTANT.md), puis `npm run deploy`. Le travail local ne remplace le site qu’après publication.
