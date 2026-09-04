# Le Reflux de Yarath-Maximal

Dossier de campagne narrative pour **Warhammer: The Horus Heresy — 3e édition**.
Cinq missions à embranchement pour quatre joueurs (Jean, Raphaël, Thomas, Tristan),
alternant batailles planétaires et Zone Mortalis, plafond de 3 000 points par partie,
tables composées de 4 plateaux pliables de 704 × 607 mm.

## Contenu du dépôt

| Chemin                       | Rôle                                                     |
| ---------------------------- | -------------------------------------------------------- |
| `index.html`                 | Le dossier de campagne complet                           |
| `pages/blood_angels.html`    | Ordre de déploiement du Ier Bataillon (Blood Angels)     |
| `pages/dark_mechanicum.html` | Ordre de déploiement du Dark Mechanicum                  |
| `assets/css/style.css`       | Feuille de styles unique, partagée par les trois pages   |
| `assets/js/campagne.js`      | Diaporama, lanceur de dé et journal de guerre            |
| `assets/images/`             | Illustrations, en WebP, avec variantes pour `srcset`     |
| `assets/fonts/`              | Cinzel, Spectral et JetBrains Mono, auto-hébergées (OFL) |
| `.nojekyll`                  | Désactive Jekyll côté GitHub Pages                       |

**Aucune dépendance à l'exécution, et aucun appel à un domaine tiers.** Le site
est en HTML, CSS et JavaScript standard : pas de framework, pas de CDN, pas
d'étape de compilation. Les polices sont servies depuis le dépôt — donc aucune
adresse IP de visiteur n'est transmise hors UE (RGPD), et la page fonctionne
hors ligne.

## Principes de développement

Trois règles tiennent le projet, et l'accessibilité en dépend :

1. **Aucun style en ligne.** Tout passe par une classe dans `assets/css/style.css`.
   Un `style="..."` dans le HTML l'emporte sur la feuille de styles, ne peut être
   ni réutilisé ni surchargé par une feuille utilisateur — et ce dernier point
   est une exigence d'accessibilité, pas une préférence de style.
2. **Mobile-first.** Les styles de base décrivent le téléphone ; les media
   queries `min-width` n'ajoutent des colonnes que si la place existe. Pour une
   nouvelle grille, préférer `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))`,
   qui se réorganise sans media query.
3. **Amélioration progressive.** Le HTML seul doit être utilisable. Un contrôle
   qui n'a de sens qu'avec JavaScript (le bouton pause du diaporama, le lanceur
   de dé) est créé ou dévoilé par le script, jamais écrit en dur : un bouton mort
   est pire qu'un bouton absent.

Un `<button>`, un `<table>`, un `<details>` natifs valent toujours mieux que leur
imitation en `<div>` : le navigateur fournit gratuitement le rôle, la prise de
focus, le clavier et l'annonce au lecteur d'écran.

## Développement

```bash
npm install                                  # Prettier, seule dépendance (dev)
npx prettier --write .                       # formate HTML, CSS et JS
npx html-validate index.html pages/*.html    # validation
```

Il n'y a rien à compiler : ouvrir `index.html` dans un navigateur suffit.

### Ajouter une image

1. Convertir en WebP et **ne jamais dépasser 2× la largeur d'affichage réelle**
   (un blason affiché en 200 px n'a pas besoin de 3000 px de côté).
2. Reporter dans le HTML les dimensions **réelles** du fichier en `width`/`height` :
   un ratio faux fait tressauter la page au chargement.
3. Au-delà de 600 px de large, fournir une variante demi-largeur et un `srcset`.
4. `loading="lazy"` partout, **sauf** sur l'image la plus grande au-dessus de la
   ligne de flottaison, qui prend `fetchpriority="high"`.

## Accessibilité

Le site vise le niveau **WCAG 2.1 AA** et le **RGAA 4.1**.

Points de contrôle avant tout commit :

- `Tab` depuis le haut de la page fait apparaître « Aller au contenu principal »,
  et le titre visé est **visible**, pas masqué par la barre de navigation ;
- l'anneau de focus doré est visible sur **chaque** élément atteint au clavier ;
- à 320 px de large, aucune barre de défilement horizontale sur la page ;
- à 200 % de zoom, aucun texte tronqué ni superposé ;
- toute nouvelle couleur de texte atteint 4,5:1 **sur tous les fonds du projet**,
  pas seulement sur `#0b0a09` — le fond le plus défavorable est `#221a0c` ;
- toute bordure de champ ou de bouton atteint 3:1 (critère 1.4.11) : utiliser
  `--bordure-controle`, pas `--bordure` ;
- **toute nouvelle entrée dans la barre de navigation** oblige à re-vérifier
  `scroll-padding-top` : la barre passe à la ligne, et un décalage trop court
  masque la cible des ancres.

Restent à faire, et aucun outil ne les remplace : les tests de restitution au
lecteur d'écran (NVDA, VoiceOver) et un test avec des personnes en situation de
handicap. Tant qu'ils n'ont pas eu lieu, la déclaration d'accessibilité doit
rester à « partiellement conforme ».

## Mise en ligne sur GitHub Pages

Dans le dépôt : **Settings → Pages**, source **Deploy from a branch**, branche
`main`, dossier `/ (root)`, puis **Save**. Le site est publié sous une minute à
l'adresse `https://jean-desaintangel.github.io/Siege-de-la-Forge-dHyrkanos/`.

## Mentions

Document non officiel réalisé par des joueurs. Warhammer: The Horus Heresy,
Zone Mortalis, Legiones Astartes et les noms associés sont des marques de
Games Workshop Ltd. Ce document n'est ni affilié ni approuvé par Games Workshop.

Polices Cinzel, Spectral et JetBrains Mono sous licence SIL Open Font License 1.1
(voir `assets/fonts/LICENSE-*.txt`).

Règles Zone Mortalis d'après la traduction francophone du _Journal Tactica — Zone Mortalis_
(jean-desaintangel.github.io/zone-mortalis) et les missions de lagrandecroisade.fr.
