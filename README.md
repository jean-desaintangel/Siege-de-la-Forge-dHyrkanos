# Le Reflux de Yarath-Maximal

Dossier de campagne narrative pour **Warhammer: The Horus Heresy — 3e édition**.
Cinq missions à embranchement pour quatre joueurs (Jean, Raphaël, Thomas, Tristan),
alternant batailles planétaires et Zone Mortalis, plafond de 3 000 points par partie,
tables composées de 4 plateaux pliables de 704 × 607 mm.

## Contenu du dépôt

| Chemin                    | Rôle                                                  |
| ------------------------- | ----------------------------------------------------- |
| `index.html`              | Le dossier de campagne complet                        |
| `pages/blood_angels.html` | Ordre de déploiement du Ier Bataillon (Blood Angels)  |
| `assets/css/style.css`    | Feuille de styles unique, partagée par les deux pages |
| `assets/js/campagne.js`   | Diaporama, lanceur de dé et journal de guerre         |
| `assets/images/`          | Illustrations, en WebP avec repli JPEG                |
| `AUDIT.md`                | Audit d'accessibilité WCAG 2.1 AA / RGAA 4.1          |
| `.nojekyll`               | Désactive Jekyll côté GitHub Pages                    |

**Aucune dépendance à l'exécution.** Le site est en HTML, CSS et JavaScript
standard : pas de framework, pas de CDN, pas d'étape de compilation. La seule
ressource externe est la police Google Fonts, et la page reste parfaitement
lisible sans elle (les polices de repli sont déclarées).

## Principes de développement

Trois règles tiennent le projet, et l'audit d'accessibilité en dépend :

1. **Aucun style en ligne.** Tout passe par une classe dans `assets/css/style.css`.
   Un `style="..."` dans le HTML l'emporte sur la feuille de styles et rend la
   page impossible à rendre responsive proprement.
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
npm install                 # installe Prettier (seule dépendance, en dev)
npx prettier --write .      # formate le HTML, le CSS et le JS
npx html-validate index.html pages/blood_angels.html   # validation W3C
```

Il n'y a rien à compiler : ouvrir `index.html` dans un navigateur suffit.

## Mise en ligne sur GitHub Pages

Dans le dépôt : **Settings → Pages**, source **Deploy from a branch**, branche
`main`, dossier `/ (root)`, puis **Save**. Le site est publié sous une minute à
l'adresse `https://jean-desaintangel.github.io/Siege-de-la-Forge-dHyrkanos/`.

## Accessibilité

Le site vise le niveau **WCAG 2.1 AA** et le **RGAA 4.1**. L'état de conformité,
les non-conformités restantes et le brouillon de déclaration d'accessibilité sont
dans [`AUDIT.md`](AUDIT.md).

Points de contrôle rapides avant tout commit :

- `Tab` depuis le haut de la page fait apparaître « Aller au contenu principal » ;
- l'anneau de focus doré est visible sur **chaque** élément atteint au clavier ;
- à 375 px de large, aucune barre de défilement horizontale ;
- à 200 % de zoom, aucun texte tronqué ni superposé ;
- toute nouvelle couleur de texte atteint 4,5:1 sur son fond (critère 1.4.3).

## Mentions

Document non officiel réalisé par des joueurs. Warhammer: The Horus Heresy,
Zone Mortalis, Legiones Astartes et les noms associés sont des marques de
Games Workshop Ltd. Ce document n'est ni affilié ni approuvé par Games Workshop.

Règles Zone Mortalis d'après la traduction francophone du _Journal Tactica — Zone Mortalis_
(jean-desaintangel.github.io/zone-mortalis) et les missions de lagrandecroisade.fr.
