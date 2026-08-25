# Le Reflux de Yarath-Maximal

Dossier de campagne narrative pour **Warhammer: The Horus Heresy — 3e édition**.
Cinq missions à embranchement pour quatre joueurs (Jean, Raphaël, Thomas, Tristan),
alternant batailles planétaires et Zone Mortalis, plafond de 3 000 points par partie,
tables composées de 4 plateaux pliables de 704 × 607 mm.

## Mise en ligne sur GitHub Pages

1. Créer un dépôt GitHub (public), par exemple `yarath-maximal`.
2. Y pousser le contenu de ce dossier :

   ```bash
   git init
   git add .
   git commit -m "Dossier de campagne Yarath-Maximal"
   git branch -M main
   git remote add origin https://github.com/<utilisateur>/yarath-maximal.git
   git push -u origin main
   ```

3. Dans le dépôt : **Settings → Pages**, source **Deploy from a branch**,
   branche `main`, dossier `/ (root)`, puis **Save**.
4. Le site est publié sous une minute à l'adresse
   `https://<utilisateur>.github.io/yarath-maximal/`.

## Contenu du dossier

| Fichier                     | Rôle                                                   |
| --------------------------- | ------------------------------------------------------ |
| `index.html`                | Le site : le dossier de campagne complet               |
| `support.js`                | Moteur de rendu de la page (charge React depuis unpkg) |
| `assets/carte-globale.jpg`  | Carta Galactica annotée (secteur des Étoiles Pâles)    |
| `.nojekyll`                 | Désactive Jekyll côté GitHub Pages                     |
| `Campagne Hyrkanos.dc.html` | Fichier source éditable du dossier                     |

Le site a besoin d'une connexion Internet au premier chargement (polices Google et
moteur React). Aucune autre dépendance, aucun build.

## Mentions

Document non officiel réalisé par des joueurs. Warhammer: The Horus Heresy,
Zone Mortalis, Legiones Astartes et les noms associés sont des marques de
Games Workshop Ltd. Ce document n'est ni affilié ni approuvé par Games Workshop.

Règles Zone Mortalis d'après la traduction francophone du _Journal Tactica — Zone Mortalis_
(jean-desaintangel.github.io/zone-mortalis) et les missions de lagrandecroisade.fr.
