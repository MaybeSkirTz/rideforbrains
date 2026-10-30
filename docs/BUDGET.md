# Budget de départ

Hypothèse de dimensionnement : **500 participations à 15 $ CA**, achetées séparément, environ 20 000 visites, activité concentrée autour de l’ouverture et du jour J. Aucun chiffre de participation n’est présenté comme une statistique réelle.

| Poste                              | Point de départ                                   | Limite ou coût à surveiller                                                                                                         |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Application et fichiers statiques  | Workers et Static Assets, offre gratuite possible | 100 000 requêtes Worker/jour et 10 ms CPU/requête sur Free; mesurer le coût CPU réel de l’authentification avant de choisir ce plan |
| Base D1                            | Offre gratuite possible                           | 5 millions de lignes lues/jour, 100 000 écrites/jour, stockage total 5 Go; les index comptent aussi dans les écritures              |
| Courriels                          | Resend Free                                       | 3 000/mois, 100/jour au tarif vérifié; la configuration actuelle garde une marge avec 90/jour                                       |
| Paiements                          | Stripe, sans abonnement Payments standard         | Cartes canadiennes : 2,9 % + 0,30 $ CA par transaction réussie; d’autres cartes/méthodes peuvent coûter plus                        |
| Stockage des logos et de la police | Fichiers statiques versionnés avec l’application  | Pas de R2 dans cette version; fournir des liens HTTPS pour photos et GPX                                                            |
| Nom de domaine                     | Adresse `workers.dev` possible au départ          | Un domaine personnalisé dépend du choix et du registraire; aucun domaine n’a été acheté                                             |

À 15 $ par transaction, les frais Stripe standards représentent environ **0,74 $ par achat**, soit environ **370 $ pour 500 transactions**, avant taxes éventuelles sur les frais et différences selon les cartes. Regrouper plusieurs participations dans une même commande réduit le nombre de frais fixes. Le produit brut théorique est 7 500 $ CA; il ne s’agit ni du montant remis à Brain Canada ni d’un bénéfice garanti.

Une pointe de 500 connexions et confirmations dépasse largement 100 courriels/jour. Resend Free convient au développement et à un lancement très limité; il ne doit pas être choisi pour cette pointe sans adaptation. L’offre Pro consultée affiche **20 $ US/mois pour 50 000 courriels** et sans plafond quotidien annoncé, avec dépassements facturés. Vérifier les conditions au moment de souscrire et obtenir l’accord de Thomas. Aucune souscription n’est effectuée par le code. La limite applicative quotidienne doit ensuite être adaptée au plan choisi, et un essai de charge réel reste nécessaire.

Sur Free, dépasser les quotas D1 provoque des erreurs jusqu’au renouvellement du quota ou à une adaptation du plan; le site ne dispose donc pas d’une capacité illimitée. Un plan Workers payant peut devenir nécessaire selon le CPU et les pointes. Sur un plan payant, les dépassements peuvent être facturés : mettre en place une surveillance d’usage et décider du budget avant de changer d’offre.

Les tarifs ci-dessus ont été consultés le **29 octobre 2026**. Les offres peuvent changer. Les montants US de l’hébergement/courriel ne doivent pas être additionnés aux dollars canadiens des inscriptions sans conversion.

Sources officielles : [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [Resend](https://resend.com/pricing), [Stripe Canada](https://stripe.com/pricing?region=canada).
