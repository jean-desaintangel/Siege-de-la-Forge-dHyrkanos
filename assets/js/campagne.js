/* =============================================================================
   Le Reflux de Yarath-Maximal — comportements de la page d'accueil
   -----------------------------------------------------------------------------
   Trois modules indépendants : le diaporama, le lanceur de dé, le journal de
   guerre. Aucun n'est indispensable à la lecture du dossier.

   PRINCIPE DIRECTEUR — l'amélioration progressive.
   Le HTML seul doit déjà être utilisable : le diaporama défile alors à la
   souris ou au doigt (CSS `scroll-snap`), la table des missions se lit avec un
   vrai dé, et le journal s'affiche avec ses valeurs par défaut. Ce fichier
   n'AJOUTE que du confort. C'est pour cela que les boutons qui n'ont de sens
   qu'avec JavaScript (pause du diaporama, lanceur de dé) sont créés ou dévoilés
   ici, et pas écrits en dur dans le HTML : un bouton mort est pire qu'un bouton
   absent.

   Le script est chargé avec `defer` : il s'exécute après l'analyse du HTML,
   donc le DOM est complet et aucune attente n'est nécessaire.
   ============================================================================= */

(() => {
  "use strict";

  /** L'utilisateur a-t-il demandé à son système de réduire les animations ?
   *  On l'interroge une fois et on s'y tient (WCAG 2.3.3 / RGAA 13.8). */
  const mouvementReduit =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===========================================================================
     1. Diaporama du théâtre d'opérations
     ===========================================================================
     Le défilement s'appuie sur le scroll natif du conteneur, pas sur un
     `transform`. POURQUOI : le scroll natif reste utilisable au doigt, à la
     molette et aux flèches du clavier même si ce script échoue, et le navigateur
     gère seul le `scroll-snap`. Un `transform` aurait figé le diaporama sur la
     première image en cas d'erreur JavaScript.
     ========================================================================= */
  function initDiaporama() {
    const piste = document.getElementById("diaporama-piste");
    if (!piste) return;

    const cadre = piste.parentElement;
    const vues = Array.from(piste.children);
    const total = vues.length;
    if (total < 2) return;

    const statut = document.getElementById("diaporama-statut");
    const precedent = document.getElementById("diaporama-precedent");
    const suivant = document.getElementById("diaporama-suivant");
    const zonePuces = document.getElementById("diaporama-puces");
    const DELAI = 5000;

    let index = 0;
    let minuteur = null;
    let enPause = mouvementReduit;

    // Les contrôles n'existent que si ce script tourne : c'est la classe
    // `js-actif` qui les rend visibles (voir style.css).
    cadre.classList.add("js-actif");

    /* --- Bouton pause / lecture --------------------------------------------
       WCAG 2.2.2 : un contenu qui défile seul plus de 5 secondes doit pouvoir
       être arrêté. C'est un critère de niveau A, le plus élémentaire. */
    const boutonPause = document.createElement("button");
    boutonPause.type = "button";
    boutonPause.className = "diaporama-pause";
    const icone = document.createElement("span");
    icone.setAttribute("aria-hidden", "true");
    boutonPause.append(icone);
    cadre.append(boutonPause);

    function majBoutonPause() {
      boutonPause.setAttribute(
        "aria-label",
        enPause ? "Lancer le diaporama" : "Mettre le diaporama en pause",
      );
      icone.textContent = enPause ? "▶" : "❚❚";
    }

    /* --- Puces de navigation ------------------------------------------------
       Chaque puce porte un intitulé explicite : un bouton vide n'est annoncé
       que « bouton » par un lecteur d'écran (WCAG 4.1.2 / RGAA 11.9). */
    const puces = vues.map((_, i) => {
      const p = document.createElement("button");
      p.type = "button";
      p.className = "diaporama-puce";
      p.setAttribute("aria-label", `Afficher l’image ${i + 1} sur ${total}`);
      p.addEventListener("click", () => aller(i, true));
      zonePuces.append(p);
      return p;
    });

    function refleter(annoncer) {
      puces.forEach((p, i) => {
        p.classList.toggle("est-active", i === index);
        // `aria-current` porte l'information que l'opacité ne véhicule que
        // visuellement.
        if (i === index) p.setAttribute("aria-current", "true");
        else p.removeAttribute("aria-current");
      });
      // On n'annonce que les changements demandés par l'utilisateur : annoncer
      // chaque rotation automatique noierait le lecteur d'écran sous le bruit.
      if (annoncer && statut) {
        statut.textContent = `Image ${index + 1} sur ${total}`;
      }
    }

    function aller(i, annoncer) {
      index = ((i % total) + total) % total;
      piste.scrollTo({
        left: vues[index].offsetLeft - piste.offsetLeft,
        behavior: mouvementReduit ? "auto" : "smooth",
      });
      refleter(annoncer);
    }

    function demarrer() {
      if (minuteur || enPause) return;
      minuteur = setInterval(() => aller(index + 1, false), DELAI);
    }

    function arreter() {
      if (!minuteur) return;
      clearInterval(minuteur);
      minuteur = null;
    }

    boutonPause.addEventListener("click", () => {
      enPause = !enPause;
      majBoutonPause();
      if (enPause) arreter();
      else demarrer();
    });

    suivant.addEventListener("click", () => aller(index + 1, true));
    precedent.addEventListener("click", () => aller(index - 1, true));

    // Pause au survol ET au focus. Sans le focus, l'image changerait sous les
    // doigts d'un utilisateur au clavier pendant qu'il lit une légende.
    cadre.addEventListener("mouseenter", arreter);
    cadre.addEventListener("mouseleave", demarrer);
    cadre.addEventListener("focusin", arreter);
    cadre.addEventListener("focusout", demarrer);

    // Si l'utilisateur fait défiler lui-même, on recale l'index sur l'image
    // réellement visible plutôt que de le contredire au prochain tic.
    let recalage;
    piste.addEventListener("scroll", () => {
      clearTimeout(recalage);
      recalage = setTimeout(() => {
        const largeur = piste.clientWidth || 1;
        const vu = Math.round(piste.scrollLeft / largeur);
        if (vu !== index && vu >= 0 && vu < total) {
          index = vu;
          refleter(false);
        }
      }, 120);
    });

    majBoutonPause();
    refleter(false);
    demarrer();
  }

  /* ===========================================================================
     2. Lanceur de dé des missions Zone Mortalis
     ===========================================================================
     La table des six missions est écrite dans le HTML : elle reste utilisable
     avec un vrai D6. Ce bouton n'est donc qu'un raccourci, dévoilé seulement
     s'il peut fonctionner.
     ========================================================================= */
  const MISSIONS_ZM = [
    "Assaut de secteur",
    "Sans quartier",
    "Terre ensanglantée",
    "Prise de contrôle",
    "Nexus de ruine",
    "Domination totale",
  ];

  function initLanceur() {
    const zone = document.getElementById("lanceur");
    const bouton = document.getElementById("lancer-de");
    const sortie = document.getElementById("de-texte");
    if (!zone || !bouton || !sortie) return;

    zone.hidden = false;
    bouton.addEventListener("click", () => {
      const de = 1 + Math.floor(Math.random() * 6);
      sortie.textContent = `D6 : ${de} — ${MISSIONS_ZM[de - 1]}`;
      // On met aussi la ligne correspondante en évidence dans la table.
      document
        .querySelectorAll(".table-des tbody tr")
        .forEach((tr, i) => tr.classList.toggle("est-tiree", i === de - 1));
    });
  }

  /* ===========================================================================
     3. Journal de guerre
     ===========================================================================
     Les quatre lignes sont écrites dans le HTML. Ce module ne fait qu'ajouter
     la persistance et le calcul du classement.
     ========================================================================= */
  const CLE = "yarath-journal-v2";
  const NOMS_DEFAUT = ["Raphaël", "Jean", "Thomas", "Tristan"];
  const MAX_POINTS = 99;

  /** Assainit ce qui sort de localStorage.
   *
   *  POURQUOI cette fonction existe : une donnée qui a quitté la mémoire du
   *  programme redevient une donnée non fiable, même si c'est nous qui l'y avons
   *  mise. L'utilisateur peut éditer localStorage depuis la console, une
   *  extension peut l'écrire, le poste peut être partagé. Sans ce filtre, un
   *  `points: "abc"` ferait planter le calcul du meneur.
   *
   *  @param {unknown} brut  la valeur issue de JSON.parse
   *  @returns {Array<{nom: string, victoires: number, points: number}>|null}
   *           un tableau de 4 lignes valides, ou null si la donnée est inutilisable
   */
  function assainir(brut) {
    if (!Array.isArray(brut) || brut.length !== 4) return null;
    return brut.map((l, i) => {
      const source = l && typeof l === "object" ? l : {};
      const borner = (v) =>
        Number.isInteger(v) ? Math.max(0, Math.min(MAX_POINTS, v)) : 0;
      return {
        nom:
          typeof source.nom === "string" && source.nom.trim()
            ? source.nom.slice(0, 40)
            : NOMS_DEFAUT[i],
        victoires: borner(source.victoires),
        points: borner(source.points),
      };
    });
  }

  function initJournal() {
    const table = document.getElementById("table-journal");
    if (!table) return;

    const lignes = Array.from(table.querySelectorAll("tbody tr"));
    const alerte = document.getElementById("journal-alerte");
    const sortieMeneur = document.getElementById("meneur-txt");
    const sortieDernier = document.getElementById("dernier-txt");
    const sortieEtat = document.getElementById("etat-campagne");

    /** Lit l'état courant depuis le DOM — le DOM est la source de vérité,
     *  localStorage n'en est qu'une copie. */
    function lireDom() {
      return lignes.map((tr) => ({
        nom: tr.querySelector(".champ-nom").value.trim() || "Joueur",
        victoires: Number(
          tr.querySelector('[data-champ="victoires"]').textContent,
        ),
        points: Number(tr.querySelector('[data-champ="points"]').textContent),
      }));
    }

    function ecrireDom(donnees) {
      donnees.forEach((d, i) => {
        const tr = lignes[i];
        tr.querySelector(".champ-nom").value = d.nom;
        tr.querySelector('[data-champ="victoires"]').textContent = d.victoires;
        tr.querySelector('[data-champ="points"]').textContent = d.points;
        // Les intitulés des boutons citent le joueur : ils doivent suivre le
        // renommage, sans quoi le lecteur d'écran annoncerait l'ancien nom.
        tr.querySelector('[data-action="plus"]').setAttribute(
          "aria-label",
          `Ajouter un point de campagne à ${d.nom}`,
        );
        tr.querySelector('[data-action="moins"]').setAttribute(
          "aria-label",
          `Retirer un point de campagne à ${d.nom}`,
        );
      });
    }

    function signaler(message) {
      if (!alerte) return;
      alerte.textContent = message;
      alerte.hidden = !message;
    }

    function sauver(donnees) {
      try {
        localStorage.setItem(CLE, JSON.stringify(donnees));
        signaler("");
      } catch (e) {
        // Ne PAS avaler l'erreur en silence : l'utilisateur croirait sauvegarder
        // alors que rien n'est écrit (navigation privée stricte, quota dépassé).
        signaler(
          "Sauvegarde impossible sur cet appareil — notez les scores à la main.",
        );
      }
    }

    function classer(donnees) {
      const maxi = Math.max(...donnees.map((d) => d.points));
      const mini = Math.min(...donnees.map((d) => d.points));
      const egalite = maxi === mini;
      const noms = (seuil) =>
        donnees
          .filter((d) => d.points === seuil)
          .map((d) => d.nom)
          .join(", ");

      sortieMeneur.textContent = egalite
        ? "Aucun meneur"
        : `Meneur — ${noms(maxi)} (${maxi})`;
      sortieDernier.textContent = egalite
        ? "Aucun dernier"
        : `Dernier — ${noms(mini)} (${mini})`;
      sortieEtat.textContent = egalite
        ? "Campagne à l’équilibre — personne ne mène"
        : "Le dernier choisit la branche IV et la mission V";
    }

    function majDepuisDom() {
      const donnees = lireDom();
      classer(donnees);
      sauver(donnees);
    }

    // --- Restauration -------------------------------------------------------
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) {
        const propre = assainir(JSON.parse(brut));
        if (propre) ecrireDom(propre);
      }
    } catch (e) {
      // Donnée corrompue : on garde les valeurs par défaut du HTML et on le dit.
      signaler("Journal précédent illisible — reparti des valeurs par défaut.");
    }

    // --- Interactions -------------------------------------------------------
    table.addEventListener("click", (e) => {
      const bouton = e.target.closest("[data-action]");
      if (!bouton) return;
      const tr = bouton.closest("tr");
      const pas = bouton.dataset.action === "plus" ? 1 : -1;
      ["points", "victoires"].forEach((champ) => {
        const cell = tr.querySelector(`[data-champ="${champ}"]`);
        const valeur = Number(cell.textContent) + pas;
        cell.textContent = Math.max(0, Math.min(MAX_POINTS, valeur));
      });
      majDepuisDom();
    });

    table.addEventListener("input", (e) => {
      if (e.target.classList.contains("champ-nom")) majDepuisDom();
    });

    const boutonReset = document.getElementById("reinitialiser");
    if (boutonReset) {
      boutonReset.addEventListener("click", () => {
        ecrireDom(NOMS_DEFAUT.map((nom) => ({ nom, victoires: 0, points: 0 })));
        majDepuisDom();
      });
    }

    classer(lireDom());
  }

  initDiaporama();
  initLanceur();
  initJournal();
})();
