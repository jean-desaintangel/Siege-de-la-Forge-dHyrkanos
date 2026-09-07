/* =============================================================================
   Archives du Mechanicum — comportements de pages/archives.html
   -----------------------------------------------------------------------------
   Trois modules indépendants, tous facultatifs :
     1. le sas d'authentification (verrouille puis déverrouille le coffre) ;
     2. le compteur « temps avant détection » ;
     3. les boutons de téléchargement, qui échouent toujours — c'est le but.

   PRINCIPE DIRECTEUR — l'amélioration progressive, à l'envers.
   Sur les autres pages du dépôt, le script AJOUTE du confort. Ici il RETIRE
   quelque chose : c'est lui qui masque le coffre au chargement. Le raisonnement
   est le même dans les deux cas — le HTML livré doit rester lisible seul. Si ce
   fichier ne se charge pas (réseau coupé, extension qui filtre, erreur de
   syntaxe sur un vieux navigateur), le visiteur voit les quatre dossiers au
   lieu d'une page vide. Un verrou qui casse doit casser en position OUVERTE
   quand il ne protège rien de réel.

   Le script est chargé avec `defer` : il s'exécute après l'analyse du HTML,
   donc le DOM est complet et aucune attente n'est nécessaire.

   PISTES SONORES (non implémentées volontairement)
   Un son déclenché sans action de l'utilisateur est bloqué par tous les
   navigateurs depuis 2018, et reste une gêne d'accessibilité (WCAG 1.4.2 : tout
   son de plus de 3 s doit pouvoir être arrêté). Si vous en voulez, la bonne
   place est :
     - au clic sur « Accéder aux archives » : un relais qui claque ;
     - à chaque ligne du terminal : un tic de télétype, volume ≤ 0,2 ;
     - au passage sous 60 s : une alarme lente.
   Les trois doivent être coupés par un bouton de sourdine persistant, et
   silencieux par défaut au premier chargement.
   ============================================================================= */

(() => {
  "use strict";

  /** L'utilisateur a-t-il demandé à son système de réduire les animations ?
   *  On l'interroge une fois et on s'y tient (WCAG 2.3.3 / RGAA 13.8). */
  const mouvementReduit =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===========================================================================
     1. Le sas d'authentification
     ===========================================================================
     Séquence : masquer le coffre → créer le bouton → à l'activation, dérouler
     les lignes du cogitateur → déverrouiller → déplacer le focus.
     ========================================================================= */
  function initSas() {
    const coffre = document.getElementById("coffre");
    const terminal = document.getElementById("sas-terminal");
    const actions = document.getElementById("sas-actions");
    const invite = document.getElementById("sas-invite");
    if (!coffre || !terminal || !actions) return;

    // Le verrou n'est posé QUE maintenant, c'est-à-dire seulement si ce script
    // tourne. `hidden` retire l'élément de l'affichage, de l'arbre
    // d'accessibilité ET du parcours de tabulation — contrairement à un
    // `opacity: 0` en CSS, qui laisserait le clavier tabuler dans le vide.
    coffre.hidden = true;
    document.body.classList.add("archives-verrouille");

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton sas-bouton";
    bouton.textContent = "Accéder aux archives";
    actions.appendChild(bouton);

    const lignes = [
      "> connexion au nœud 44-D.101 …",
      "> empreinte noospherique : NON RECONNUE",
      "> repli sur autorisation de rang inférieur …",
      "> autorisation provisoire : ACCORDÉE",
      "> descellement du Corpus Interdictus …",
      "> quatre pièces déverrouillées.",
    ];

    let enCours = false;

    bouton.addEventListener("click", () => {
      if (enCours) return;
      enCours = true;
      bouton.disabled = true;
      bouton.textContent = "Descellement en cours…";
      if (invite) invite.textContent = "Séquence de descellement engagée.";
      derouler(0);
    });

    /** Affiche les lignes l'une après l'autre.
     *  Sans animation demandée : tout est écrit d'un coup. */
    function derouler(i) {
      if (i >= lignes.length) return void ouvrir();
      if (mouvementReduit) {
        ecrireLigne(lignes[i], true);
        derouler(i + 1);
        return;
      }
      ecrireLigne(lignes[i], false, () => {
        window.setTimeout(() => derouler(i + 1), 220);
      });
    }

    /** Écrit une ligne, caractère par caractère si l'animation est permise.
     *
     *  ACCESSIBILITÉ — le point délicat de toute animation de « frappe ».
     *  Le conteneur porte `aria-live="polite"` : toute modification de son texte
     *  est annoncée. Animer le texte caractère par caractère DANS la zone live
     *  ferait donc annoncer « c », « co », « con »… Insupportable.
     *  Solution : le texte animé est `aria-hidden="true"` (le lecteur d'écran
     *  l'ignore), et la ligne COMPLÈTE est ajoutée une seule fois, à la fin,
     *  dans un `.sr-only` invisible à l'œil. Chaque annonce est donc une phrase
     *  entière, prononcée une fois. */
    function ecrireLigne(texte, immediat, fini) {
      const ligne = document.createElement("p");
      ligne.className = "sas-ligne";
      ligne.setAttribute("aria-hidden", "true");
      terminal.appendChild(ligne);

      const annoncer = () => {
        const echo = document.createElement("span");
        echo.className = "sr-only";
        echo.textContent = texte.replace(/^>\s*/, "");
        terminal.appendChild(echo);
        if (fini) fini();
      };

      if (immediat) {
        ligne.textContent = texte;
        annoncer();
        return;
      }

      let n = 0;
      const battement = window.setInterval(() => {
        n += 1;
        ligne.textContent = texte.slice(0, n);
        if (n >= texte.length) {
          window.clearInterval(battement);
          annoncer();
        }
      }, 22);
    }

    /** Déverrouillage : on retire `hidden`, on annonce, on déplace le focus. */
    function ouvrir() {
      coffre.hidden = false;
      document.body.classList.remove("archives-verrouille");
      document.body.classList.add("archives-ouvert");

      bouton.remove();
      const etat = document.createElement("span");
      etat.className = "jeton sas-jeton";
      etat.textContent = "Accès accordé · quantum de consultation entamé";
      actions.appendChild(etat);
      if (invite) {
        invite.textContent =
          "Autorisation provisoire accordée. Le vault est ouvert.";
      }

      /* GESTION DU FOCUS — obligatoire, et souvent oubliée.
         Le clavier se trouve encore sur le bouton, qui vient de disparaître :
         sans intervention, le focus retombe sur `<body>` et l'utilisateur au
         clavier repart du haut de la page. On le pose donc sur le contenu qui
         vient d'apparaître. `tabindex="-1"` rend un élément focalisable par
         script sans l'insérer dans l'ordre de tabulation. */
      coffre.setAttribute("tabindex", "-1");
      coffre.focus({ preventScroll: true });
      coffre.scrollIntoView({
        behavior: mouvementReduit ? "auto" : "smooth",
        block: "start",
      });

      initDetection();
    }
  }

  /* ===========================================================================
     2. Compteur « temps avant détection »
     ===========================================================================
     Construit entièrement en JavaScript : un compteur figé serait un décor
     cassé, pas un décor. Il n'apparaît donc qu'après le déverrouillage.
     ========================================================================= */
  const QUANTUM = 600; // 10 minutes, en secondes

  function initDetection() {
    const hote = document.getElementById("detection");
    if (!hote || hote.dataset.pret === "oui") return;
    hote.dataset.pret = "oui";

    hote.innerHTML = [
      '<div class="carte carte--rouge carte--accent-rouge compteur-detection">',
      '<p class="etiquette etiquette--rouge">Balayage d\'autocensus</p>',
      '<p class="compteur-valeur" id="compteur-valeur" aria-hidden="true">10:00</p>',
      '<p class="texte-petit compteur-legende" id="compteur-legende">',
      "Temps estimé avant que le recensement ne rapproche cette session du vault.",
      "</p>",
      '<p class="sr-only" id="compteur-annonce" role="status" aria-live="polite"></p>',
      '<p class="compteur-actions">',
      '<button type="button" class="bouton bouton--fantome" id="compteur-bouton">Suspendre le balayage</button>',
      "</p>",
      "</div>",
    ].join("");

    const valeur = document.getElementById("compteur-valeur");
    const legende = document.getElementById("compteur-legende");
    const annonce = document.getElementById("compteur-annonce");
    const bouton = document.getElementById("compteur-bouton");

    let reste = QUANTUM;
    let minuteur = null;
    let detecte = false;

    /* WCAG 2.2.2 « Mettre en pause, arrêter, masquer » : toute information qui
       se met à jour toute seule doit pouvoir être arrêtée par l'utilisateur.
       C'est la raison d'être du bouton — pas seulement le style. */
    function afficher() {
      const m = String(Math.floor(reste / 60)).padStart(2, "0");
      const s = String(reste % 60).padStart(2, "0");
      valeur.textContent = m + ":" + s;
    }

    /* Le compte à rebours n'est PAS annoncé chaque seconde : ce serait un
       lecteur d'écran qui parle sans arrêt. Seuls quatre paliers le sont. */
    function annoncerSiPalier() {
      if (reste === 300) annonce.textContent = "Cinq minutes avant détection.";
      else if (reste === 60)
        annonce.textContent = "Une minute avant détection.";
      else if (reste === 10)
        annonce.textContent = "Dix secondes avant détection.";
    }

    function battre() {
      reste -= 1;
      if (reste <= 0) {
        reste = 0;
        afficher();
        return void declencher();
      }
      afficher();
      annoncerSiPalier();
    }

    function demarrer() {
      if (minuteur || detecte) return;
      minuteur = window.setInterval(battre, 1000);
      bouton.textContent = "Suspendre le balayage";
    }

    function suspendre() {
      window.clearInterval(minuteur);
      minuteur = null;
      bouton.textContent = "Reprendre le balayage";
    }

    function declencher() {
      window.clearInterval(minuteur);
      minuteur = null;
      detecte = true;
      document.body.classList.add("archives-detecte");
      valeur.textContent = "00:00";
      legende.textContent =
        "Session repérée. Le vault a signalé une consultation non autorisée à l'autocensus du secteur.";
      annonce.textContent =
        "Détection. Session repérée par le recensement du secteur.";
      bouton.textContent = "Purger les journaux";
    }

    bouton.addEventListener("click", () => {
      if (detecte) {
        // Réinitialisation : on efface la « trace » et on repart d'un quantum.
        detecte = false;
        reste = QUANTUM;
        document.body.classList.remove("archives-detecte");
        legende.textContent =
          "Journaux purgés. Un nouveau quantum de consultation a été alloué.";
        annonce.textContent = "Journaux purgés. Le décompte reprend.";
        afficher();
        demarrer();
        return;
      }
      if (minuteur) suspendre();
      else demarrer();
    });

    afficher();
    demarrer();
  }

  /* ===========================================================================
     3. Les boutons de téléchargement
     ===========================================================================
     Ils échouent toujours, et c'est le propos : on ne sort rien du vault.
     Ce sont de vrais `<button type="button">` écrits dans le HTML, et non des
     `<a href="#">` déguisés — un lien annoncé « lien » qui ne mène nulle part
     est un mensonge fait au lecteur d'écran. Un bouton qui refuse est honnête.
     ========================================================================= */
  function initTelechargements() {
    const sortie = document.getElementById("terminal-sortie");
    const boutons = document.querySelectorAll(".dossier-telecharger");
    if (!sortie || boutons.length === 0) return;

    const refus = [
      "ERREUR 0x2F — extraction refusée : la pièce est scellée au niveau du vault, pas au niveau du fichier.",
      "ERREUR 0x41 — le cogitateur de seuil a interrompu le transfert au bout de 3 octets. Les 3 octets ont été effacés.",
      "ERREUR 0x08 — duplication interdite par rite. Recopiez à la main, comme il se doit.",
      "ERREUR 0x77 — support de destination jugé impur. Aucune donnée n'a quitté l'archive.",
      "ERREUR 0x1C — demande consignée. Votre identifiant de session a été transmis à Magos Egax.",
    ];

    let n = 0;
    boutons.forEach((bouton) => {
      bouton.addEventListener("click", () => {
        sortie.textContent = refus[n % refus.length];
        n += 1;
        // La zone porte `role="status"` : le message est annoncé sans voler le
        // focus. On ne déplace donc PAS le curseur, l'utilisateur reste sur le
        // bouton qu'il vient d'activer.
        sortie.classList.remove("terminal-sortie--vive");
        // Forcer un reflow relance l'animation CSS même si le texte est
        // identique deux fois de suite. `void` évite qu'un minifieur ne
        // supprime la lecture, qui semble inutile mais ne l'est pas.
        void sortie.offsetWidth;
        sortie.classList.add("terminal-sortie--vive");
      });
    });
  }

  initSas();
  initTelechargements();
})();
