/* =============================================================================
   Le Reflux de Yarath-Maximal — comportements de la carte du secteur
   -----------------------------------------------------------------------------
   Un seul module : la liaison entre le plan orbital (le SVG) et les fiches des
   mondes (le texte). Rien ici n'est indispensable.

   PRINCIPE DIRECTEUR — l'amélioration progressive.
   Sans ce fichier, la page reste entièrement utilisable : chaque monde du plan
   est un `<a href="#monde-...">`, donc un lien d'ancre ordinaire qui amène à sa
   fiche, et la fiche visée s'encadre d'or grâce au sélecteur CSS `:target`.
   Ce script n'AJOUTE que trois choses :

     1. un panneau de synthèse sous le plan, créé et dévoilé ici ;
     2. la mise en évidence croisée au survol (plan → fiche) ;
     3. un bouton « Effacer la sélection », qui n'a aucun sens sans lui.

   Le panneau est écrit dans le HTML avec l'attribut `hidden` : un panneau vide
   affiché en permanence serait un défaut, pas une fonctionnalité.

   AUCUNE DONNÉE N'EST RECOPIÉE ICI. Les noms et les résumés sont lus dans les
   attributs `data-nom` et `data-resume` des fiches. Le HTML reste la seule
   source : une fiche corrigée met le panneau à jour toute seule.

   Chargé avec `defer` : le DOM est complet au moment où ce code s'exécute.
   ============================================================================= */

(() => {
  "use strict";

  const plan = document.getElementById("carte-systeme");
  const panneau = document.getElementById("plan-panneau");
  if (!plan || !panneau) return;

  // Tous les liens du plan, et la fiche que chacun vise.
  const liens = Array.from(plan.querySelectorAll("a[data-monde]"));
  if (liens.length === 0) return;

  const corps = document.getElementById("plan-panneau-corps");
  let selection = null;

  /** Fiche visée par un lien du plan, ou `null` si l'ancre ne mène nulle part.
   *  On passe par `getAttribute` : la propriété `href` d'un lien SVG est un
   *  objet `SVGAnimatedString`, pas une chaîne. */
  function ficheDe(lien) {
    const ancre = lien.getAttribute("href") || "";
    if (!ancre.startsWith("#")) return null;
    return document.getElementById(ancre.slice(1));
  }

  /* ---------------------------------------------------------------------------
     1. Le panneau de synthèse
     ------------------------------------------------------------------------ */

  // Le titre du panneau existe déjà dans le HTML ; on n'y ajoute que le bouton,
  // parce qu'il ne sert à rien sans ce script.
  const actions = document.createElement("p");
  actions.className = "plan-panneau-actions";
  const boutonEffacer = document.createElement("button");
  boutonEffacer.type = "button";
  boutonEffacer.className = "bouton bouton--fantome";
  boutonEffacer.textContent = "Effacer la sélection";
  actions.append(boutonEffacer);
  panneau.append(actions);

  /** Écrit le contenu du panneau. On remplace les nœuds plutôt que d'assigner
   *  `innerHTML` : rien de ce qui vient du DOM n'est ré-interprété comme du
   *  HTML, et la région `aria-live` n'annonce qu'un seul changement. */
  function afficher(fiche) {
    corps.replaceChildren();

    const nom = document.createElement("p");
    nom.className = "plan-panneau-nom";
    nom.textContent = fiche.dataset.nom || "";

    const resume = document.createElement("p");
    resume.className = "plan-panneau-resume";
    resume.textContent = fiche.dataset.resume || "";

    const lien = document.createElement("a");
    lien.className = "lien-bloc";
    lien.href = "#" + fiche.id;
    lien.textContent = "Lire la fiche complète →";

    const ligne = document.createElement("p");
    ligne.className = "texte-petit";
    ligne.append(lien);

    corps.append(nom, resume, ligne);
    panneau.hidden = false;
  }

  function effacer() {
    liens.forEach((lien) => lien.removeAttribute("aria-current"));
    document
      .querySelectorAll(".fiche-monde.est-designee")
      .forEach((f) => f.classList.remove("est-designee"));
    corps.replaceChildren();
    panneau.hidden = true;
    selection = null;
  }

  /** Sélectionne un monde. `aria-current` porte l'état : le style le suit
   *  (voir style.css), donc l'affichage ne peut pas diverger de ce qui est
   *  annoncé au lecteur d'écran. */
  function selectionner(lien) {
    // Un clic déclenche `focus` PUIS `click` : sans ce garde-fou, le panneau
    // serait reconstruit deux fois pour un seul geste de l'utilisateur — et la
    // région `aria-live` annoncerait deux fois le même monde.
    if (selection === lien) return;

    const fiche = ficheDe(lien);
    if (!fiche) return;

    liens.forEach((autre) => autre.removeAttribute("aria-current"));
    document
      .querySelectorAll(".fiche-monde.est-designee")
      .forEach((f) => f.classList.remove("est-designee"));

    lien.setAttribute("aria-current", "true");
    fiche.classList.add("est-designee");
    afficher(fiche);
    selection = lien;
  }

  boutonEffacer.addEventListener("click", () => {
    effacer();
    /* Le bouton disparaît avec le panneau : sans intervention, le focus
       retomberait au début du document (WCAG 2.4.3 — ordre de focus cohérent).
       On le rend au CADRE du plan, et non au monde qu'on vient de
       désélectionner : ce dernier se re-sélectionnerait aussitôt, puisque la
       prise de focus vaut sélection (voir plus bas). Le cadre est focusable
       parce qu'il défile. */
    const cadre = plan.querySelector(".plan-cadre");
    if (cadre) cadre.focus();
  });

  /* ---------------------------------------------------------------------------
     2. Sélection au clic et au clavier
     ------------------------------------------------------------------------
     On ne fait PAS de `preventDefault` : le saut vers la fiche est le
     comportement que la page a déjà sans JavaScript, et le supprimer priverait
     l'utilisateur clavier du déplacement du focus. On se contente d'enrichir. */
  liens.forEach((lien) => {
    lien.addEventListener("click", () => selectionner(lien));

    // `focus` plutôt que `focusin` : les liens SVG ne bouillonnent pas de la
    // même façon selon les navigateurs, et on n'a besoin que de la cible.
    lien.addEventListener("focus", () => selectionner(lien));

    /* --- Mise en évidence croisée au survol ---
       Purement visuelle et sans état : elle ne remplace jamais la sélection,
       elle la précède. */
    const fiche = ficheDe(lien);
    if (!fiche) return;
    lien.addEventListener("mouseenter", () =>
      fiche.classList.add("est-survolee"),
    );
    lien.addEventListener("mouseleave", () =>
      fiche.classList.remove("est-survolee"),
    );
  });

  /* ---------------------------------------------------------------------------
     3. Arrivée directe sur une ancre
     ------------------------------------------------------------------------
     Un lien partagé (…/carte.html#monde-vorexis) doit ouvrir la page avec le
     bon monde déjà sélectionné. `hashchange` couvre le cas du retour arrière. */
  function suivreAncre() {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const lien = liens.find((l) => l.getAttribute("href") === "#" + id);
    if (lien) selectionner(lien);
  }

  window.addEventListener("hashchange", suivreAncre);
  suivreAncre();
})();
