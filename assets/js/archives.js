/* =============================================================================
   Archives du Mechanicum — comportements de pages/archives.html
   -----------------------------------------------------------------------------
   Trois modules indépendants, tous facultatifs :
     1. le sas d'authentification (verrouille puis déverrouille le coffre) ;
     2. le compteur « temps avant détection », qui bloque la page à zéro ;
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
  const QUANTUM = 150; // 2 min 30, en secondes

  /** « 150 » → « 02:30 ». Un seul endroit sait convertir des secondes en
   *  minutes : le gabarit initial du compteur ET la mise à jour de chaque
   *  seconde passent par ici, ils ne peuvent donc pas diverger. Changer
   *  `QUANTUM` suffit, la valeur affichée au premier rendu suit toute seule. */
  function formater(secondes) {
    const m = String(Math.floor(secondes / 60)).padStart(2, "0");
    const s = String(secondes % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function initDetection() {
    const hote = document.getElementById("detection");
    if (!hote || hote.dataset.pret === "oui") return;
    hote.dataset.pret = "oui";

    hote.innerHTML = [
      '<div class="carte carte--rouge carte--accent-rouge compteur-detection">',
      '<p class="etiquette etiquette--rouge">Balayage d\'autocensus</p>',
      '<p class="compteur-valeur" id="compteur-valeur" aria-hidden="true">' +
        formater(QUANTUM) +
        "</p>",
      '<p class="texte-petit compteur-legende" id="compteur-legende">',
      "Temps estimé avant que le recensement ne rapproche cette session du vault.",
      "</p>",
      '<p class="sr-only" id="compteur-annonce" role="status" aria-live="polite"></p>',
      "</div>",
    ].join("");

    const valeur = document.getElementById("compteur-valeur");
    const legende = document.getElementById("compteur-legende");
    const annonce = document.getElementById("compteur-annonce");

    let reste = QUANTUM;
    let minuteur = null;
    let detecte = false;

    /* PAS DE BOUTON DE SUSPENSION — c'est une décision, pas un oubli.
       WCAG 2.2.1 « Délai modifiable » demande qu'un délai puisse être
       désactivé, allongé ou ajusté, et 2.2.2 qu'une information qui se met à
       jour seule puisse être arrêtée. La norme prévoit une exception : le délai
       essentiel, celui dont la suppression viderait l'activité de son sens.
       C'est le pari fait ici — le quantum de consultation EST le propos de la
       page, un compteur que l'on peut geler ne raconte plus rien.
       Deux garde-fous restent donc en place, et ne doivent pas sauter :
         - le décompte est annoncé aux paliers, personne n'est pris par
           surprise ;
         - la fin ouvre une sortie explicite, pas un cul-de-sac.
       Si le compteur redevenait un simple ornement, c'est ici qu'il faudrait
       réintroduire le bouton. */
    function afficher() {
      valeur.textContent = formater(reste);
    }

    /* Le compte à rebours n'est PAS annoncé chaque seconde : ce serait un
       lecteur d'écran qui parle sans arrêt. Deux paliers seulement, plus la
       détection elle-même. Ils sont calés sur un quantum de 2 min 30 : le
       premier tombe à peu près à mi-parcours, le second prévient de la fin. */
    function annoncerSiPalier() {
      if (reste === 60) annonce.textContent = "Une minute avant détection.";
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
      poserVerrou();
    }

    /* =========================================================================
       Le verrou de fin de quantum
       =========================================================================
       À zéro, la page ne se contente plus de changer de couleur : elle se
       bloque. Un panneau d'alerte couvre tout, le reste de la page devient
       inatteignable, et le blocage est DÉFINITIF pour cette page : la seule
       commande offerte est la sortie. Aucune purge, aucun second quantum — le
       visiteur qui veut revoir les archives recharge la page et repasse par le
       sas, ce qui est le propos.

       POURQUOI UN PANNEAU PLUTÔT QU'UN `alert()`.
       `window.alert()` gèle l'onglet entier, ne se met pas en forme, n'est pas
       traduisible et se fait bloquer par les navigateurs après quelques
       ouvertures. Un élément du document, lui, se style et s'annonce
       correctement.

       WCAG 2.1.2 « Pas de piège au clavier » : enfermer le focus est autorisé
       à condition qu'une sortie existe ET soit indiquée. C'est ici la seule
       commande du panneau, elle a le focus dès l'ouverture, et le texte la
       décrit. Ce lien est donc la pièce à ne jamais retirer.
       ======================================================================= */
    let verrou = null; // le panneau ; une fois posé, il ne se retire plus

    function poserVerrou() {
      if (verrou) return;

      verrou = document.createElement("div");
      verrou.className = "verrou-detection";
      verrou.id = "verrou-detection";
      /* `alertdialog` (et non `dialog`) : c'est un message qui interrompt.
         Le lecteur d'écran annonce le titre et la description à l'ouverture
         sans attendre que l'utilisateur explore. */
      verrou.setAttribute("role", "alertdialog");
      verrou.setAttribute("aria-modal", "true");
      verrou.setAttribute("aria-labelledby", "verrou-titre");
      verrou.setAttribute("aria-describedby", "verrou-texte");
      verrou.innerHTML = [
        '<div class="carte carte--rouge carte--accent-rouge verrou-panneau">',
        '<p class="etiquette etiquette--rouge">',
        '<span class="balise-alerte" aria-hidden="true"></span> Autocensus · session repérée',
        "</p>",
        '<h2 class="titre-carte verrou-titre" id="verrou-titre">Consultation interrompue</h2>',
        '<p id="verrou-texte">',
        "Le quantum de consultation est écoulé. Le balayage d'autocensus a ",
        "rapproché cette session du vault : le Corpus Interdictus est refermé ",
        "et vos requêtes sont consignées.",
        "</p>",
        '<p class="texte-petit">',
        "Cette session ne peut pas être reprise. Quittez les archives.",
        "</p>",
        '<p class="verrou-actions">',
        '<a class="bouton" id="verrou-sortie" href="../index.html">Quitter les archives</a>',
        "</p>",
        "</div>",
      ].join("");
      document.body.appendChild(verrou);

      /* Neutraliser l'arrière-plan. `inert` retire une branche entière du DOM
         du clic, du focus ET de l'arbre d'accessibilité : c'est exactement ce
         qu'il faut, en un attribut. Il n'existe pas sur les navigateurs
         d'avant 2023 ; on retombe alors sur `aria-hidden`, qui ne fait que la
         moitié du travail (le lecteur d'écran ignore le fond, mais la
         tabulation y passe encore — d'où le piège à tabulation ci-dessous).
         Rien n'est mémorisé pour un retour en arrière : le verrou est posé
         pour de bon. */
      const supporteInert = "inert" in HTMLElement.prototype;
      Array.prototype.forEach.call(document.body.children, (el) => {
        if (el === verrou) return;
        if (supporteInert) el.inert = true;
        else el.setAttribute("aria-hidden", "true");
      });

      // La page ne défile plus derrière le panneau.
      document.body.classList.add("archives-bloque");

      verrou.addEventListener("keydown", piegerTabulation);
      /* Le focus se trouvait dans une page qui vient de devenir inerte : sans
         ce déplacement il retomberait sur `<body>` et le panneau, pourtant
         seul élément actif, serait à chercher. */
      document.getElementById("verrou-sortie").focus();
    }

    /** Retient le focus dans le panneau. Le lien de sortie en est le seul
     *  élément focalisable : Tab et Maj+Tab le rendent donc à lui-même. Sans
     *  ce gestionnaire, sur un navigateur sans `inert`, un Tab de trop
     *  renverrait l'utilisateur dans une page qu'il n'est plus censé lire.
     *  La boucle est écrite en toute généralité — si une seconde commande
     *  était ajoutée un jour, elle continuerait de fonctionner.
     *
     *  Échap n'est volontairement PAS traité : ce panneau n'est pas une boîte
     *  de dialogue que l'on referme, c'est l'état de la page. La seule sortie
     *  est le lien, et elle mène ailleurs. */
    function piegerTabulation(evt) {
      if (evt.key !== "Tab" || !verrou) return;
      const cibles = verrou.querySelectorAll("button, [href]");
      if (cibles.length === 0) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (evt.shiftKey && document.activeElement === premier) {
        evt.preventDefault();
        dernier.focus();
      } else if (!evt.shiftKey && document.activeElement === dernier) {
        evt.preventDefault();
        premier.focus();
      }
    }

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
