/* =============================================================================
   Le Reflux de Yarath-Maximal — comportements de la page d'accueil
   -----------------------------------------------------------------------------
   Deux modules indépendants : le diaporama et le journal de guerre. Aucun n'est
   indispensable à la lecture du dossier.

   PRINCIPE DIRECTEUR — l'amélioration progressive.
   Le HTML seul doit déjà être utilisable : le diaporama défile alors à la
   souris ou au doigt (CSS `scroll-snap`), la table des missions se lit avec un
   vrai dé, et le journal s'affiche avec ses valeurs par défaut. Ce fichier
   n'AJOUTE que du confort. C'est pour cela que les boutons qui n'ont de sens
   qu'avec JavaScript (pause du diaporama) sont créés ou dévoilés ici, et pas
   écrits en dur dans le HTML : un bouton mort est pire qu'un bouton absent.

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
     2. Journal de guerre — persistance partagée
     ===========================================================================
     Le journal était sauvegardé dans `localStorage` : chaque joueur voyait SON
     navigateur, et personne ne voyait celui des autres. Les scores sont
     désormais rangés dans une base Postgres hébergée chez Supabase, lue et
     écrite directement depuis la page (voir SUPABASE.md pour la mise en place).

     TROIS NIVEAUX DE REPLI, du meilleur au pire :
       1. Supabase joignable  → scores partagés, mise à jour en direct.
       2. Supabase injoignable → repli sur localStorage + message à l'écran.
       3. Aucun JavaScript    → le tableau HTML reste lisible avec ses zéros.

     SÉCURITÉ — pourquoi la clé « anon » peut être écrite en clair.
     La clé anon n'est PAS un mot de passe : c'est un identifiant public, que
     n'importe qui peut lire dans les outils de développement du navigateur.
     Ce qui protège réellement la table, c'est la RLS (Row Level Security) de
     Postgres : les politiques écrites côté serveur n'autorisent QUE la lecture
     et la mise à jour des quatre lignes existantes — ni insertion, ni
     suppression, ni accès aux autres tables.
     Ne JAMAIS mettre la clé « service_role » dans une page web : celle-là
     ignore la RLS et donne les pleins pouvoirs sur la base.
     ========================================================================= */
  const CLE = "yarath-journal-v2";
  const NOMS_DEFAUT = ["Raphaël", "Jean", "Thomas", "Tristan"];
  const MAX_POINTS = 99;
  const TABLE = "journal_campagne";
  /** Délai d'attente avant écriture réseau, en millisecondes.
   *  Cliquer cinq fois sur « + » ne doit pas déclencher cinq requêtes : on
   *  attend que les clics se calment. C'est le principe du « debounce ». */
  const DELAI_ECRITURE = 500;

  /** Assainit UNE ligne de joueur, d'où qu'elle vienne.
   *
   *  POURQUOI : une donnée qui a quitté la mémoire du programme redevient une
   *  donnée non fiable, même si c'est nous qui l'y avons mise. L'utilisateur
   *  peut éditer localStorage depuis la console, un autre joueur peut écrire
   *  n'importe quoi dans la base avec un `curl`. Sans ce filtre, un
   *  `points: "abc"` ferait planter le calcul du meneur.
   *
   *  @param {unknown} source  l'objet brut (localStorage ou réponse Supabase)
   *  @param {number}  i       l'indice de la ligne, pour le nom par défaut
   *  @returns {{nom: string, victoires: number, points: number}}
   */
  function assainirLigne(source, i) {
    const s = source && typeof source === "object" ? source : {};
    const borner = (v) => {
      const n = Number(v);
      return Number.isInteger(n) ? Math.max(0, Math.min(MAX_POINTS, n)) : 0;
    };
    return {
      nom:
        typeof s.nom === "string" && s.nom.trim()
          ? s.nom.slice(0, 40)
          : NOMS_DEFAUT[i],
      victoires: borner(s.victoires),
      points: borner(s.points),
    };
  }

  /** Assainit un tableau complet de 4 lignes.
   *  @returns {Array|null} 4 lignes valides, ou null si la donnée est inutilisable */
  function assainir(brut) {
    if (!Array.isArray(brut) || brut.length !== 4) return null;
    return brut.map(assainirLigne);
  }

  /* ---------------------------------------------------------------------------
     2a. Les deux stockages possibles
     ---------------------------------------------------------------------------
     Les deux exposent EXACTEMENT la même interface :
        charger()        → Promise<Array|null>
        sauver(donnees)  → Promise<void>
        ecouter(rappel)  → branche les mises à jour venues des autres joueurs
     Le reste du code ne sait donc pas — et n'a pas à savoir — lequel il utilise.
     C'est le patron « stratégie » : on change l'implémentation sans toucher à
     l'appelant.
     ------------------------------------------------------------------------- */

  /** Stockage de repli : le navigateur, et lui seul. */
  function creerStockageLocal() {
    return {
      nom: "local",
      async charger() {
        const brut = localStorage.getItem(CLE);
        return brut ? assainir(JSON.parse(brut)) : null;
      },
      async sauver(donnees) {
        localStorage.setItem(CLE, JSON.stringify(donnees));
      },
      // Rien à écouter : un seul navigateur, personne d'autre n'écrit.
      ecouter() {},
    };
  }

  /** Stockage partagé : la table `journal_campagne` chez Supabase.
   *  @returns {object|null} null si le SDK n'est pas chargé ou la config absente */
  function creerStockageDistant() {
    const config = window.CONFIG_SUPABASE;
    // Trois vérifications avant de tenter quoi que ce soit : le SDK est-il
    // chargé (CDN bloqué, hors ligne) ? la config existe-t-elle ? a-t-elle été
    // remplie, ou est-elle restée sur le gabarit livré avec le dépôt ?
    if (!window.supabase) return null;
    if (!config || !config.url || !config.cleAnon) return null;
    if (config.url.includes("VOTRE-PROJET")) return null;

    const client = window.supabase.createClient(config.url, config.cleAnon);

    /** Dernier état confirmé côté base.
     *  Il sert à n'envoyer QUE les lignes réellement modifiées : un clic sur le
     *  « + » de Jean ne doit pas réécrire les quatre joueurs. */
    let dernierEtat = null;

    return {
      nom: "distant",

      async charger() {
        const { data, error } = await client
          .from(TABLE)
          .select("id, nom, victoires, points")
          .order("id");
        if (error) throw error;

        // La base rend les lignes dans un tableau ; nous, on les veut rangées
        // par indice de joueur. Une ligne manquante laisse un trou, qu'
        // `assainirLigne` remplira avec les valeurs par défaut.
        const rangees = new Array(4);
        data.forEach((l) => {
          if (l.id >= 0 && l.id < 4) rangees[l.id] = l;
        });

        dernierEtat = assainir(rangees);
        return dernierEtat;
      },

      async sauver(donnees) {
        const aEnvoyer = [];
        donnees.forEach((d, i) => {
          const ancien = dernierEtat && dernierEtat[i];
          const identique =
            ancien &&
            ancien.nom === d.nom &&
            ancien.victoires === d.victoires &&
            ancien.points === d.points;
          if (!identique) aEnvoyer.push({ id: i, valeurs: d });
        });
        if (aEnvoyer.length === 0) return;

        for (const ligne of aEnvoyer) {
          // `update` et non `insert` : les quatre lignes existent déjà et la
          // RLS interdit d'en créer. `.eq("id", …)` désigne la ligne à toucher —
          // sans lui, PostgREST refuserait la requête (garde-fou anti-écrasement).
          const { error } = await client
            .from(TABLE)
            .update({
              nom: ligne.valeurs.nom,
              victoires: ligne.valeurs.victoires,
              points: ligne.valeurs.points,
              maj_le: new Date().toISOString(),
            })
            .eq("id", ligne.id);
          if (error) throw error;
        }

        // Copie défensive : sans le `{ ...d }`, `dernierEtat` pointerait sur les
        // mêmes objets que `donnees` et le prochain diff ne verrait jamais rien.
        dernierEtat = donnees.map((d) => ({ ...d }));
      },

      ecouter(rappel) {
        client
          .channel("journal-campagne")
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: TABLE },
            (message) => {
              const l = message.new;
              if (!l || l.id < 0 || l.id >= 4) return;
              // On tient `dernierEtat` à jour même quand le changement vient
              // d'un autre joueur : sinon le prochain diff croirait devoir
              // renvoyer des valeurs périmées et écraserait son score.
              if (dernierEtat) dernierEtat[l.id] = assainirLigne(l, l.id);
              rappel(l);
            },
          )
          .subscribe();
      },
    };
  }

  /* ---------------------------------------------------------------------------
     2b. Le module lui-même
     ------------------------------------------------------------------------- */
  function initJournal() {
    const table = document.getElementById("table-journal");
    if (!table) return;

    const lignes = Array.from(table.querySelectorAll("tbody tr"));
    const alerte = document.getElementById("journal-alerte");
    const sortieMeneur = document.getElementById("meneur-txt");
    const sortieDernier = document.getElementById("dernier-txt");
    const sortieEtat = document.getElementById("etat-campagne");

    // Distant si possible, local sinon. La variable n'est pas `const` : en cas
    // de panne réseau on bascule sur le local en cours de partie.
    let stockage = creerStockageDistant() || creerStockageLocal();
    let minuteurEcriture = null;
    /** Avertissement qui doit RESTER affiché tant que la situation dure.
     *  Sans lui, la première sauvegarde locale réussie effacerait le message
     *  « base injoignable » et le joueur croirait ses scores partagés alors
     *  qu'ils ne sortent plus de son navigateur. */
    let avertissementPersistant = "";

    /** Lit l'état courant depuis le DOM — le DOM est la source de vérité,
     *  la base n'en est qu'une copie. */
    function lireDom() {
      return lignes.map((tr) => ({
        nom: tr.querySelector(".champ-nom").value.trim() || "Joueur",
        victoires: Number(
          tr.querySelector('span[data-champ="victoires"]').textContent,
        ),
        points: Number(
          tr.querySelector('span[data-champ="points"]').textContent,
        ),
      }));
    }

    /** Intitulés des quatre boutons d'une ligne.
     *
     *  POURQUOI ils sont regénérés à chaque écriture : l'intitulé cite le nom du
     *  joueur, et ce nom est modifiable. Sans cette mise à jour, un lecteur
     *  d'écran continuerait d'annoncer « Ajouter une victoire à Raphaël » après
     *  que la case a été renommée en « Marie » (WCAG 4.1.2).
     */
    function majIntitules(tr, nom) {
      const libelles = {
        "victoires:1": `Ajouter une victoire à ${nom}`,
        "victoires:-1": `Retirer une victoire à ${nom}`,
        "points:1": `Ajouter un point de campagne à ${nom}`,
        "points:-1": `Retirer un point de campagne à ${nom}`,
      };
      tr.querySelectorAll("button[data-champ]").forEach((b) => {
        b.setAttribute(
          "aria-label",
          libelles[`${b.dataset.champ}:${b.dataset.pas}`],
        );
      });
    }

    /** Écrit UNE ligne dans le DOM. Utilisé au chargement comme à la réception
     *  d'une mise à jour temps réel venue d'un autre joueur. */
    function ecrireLigne(i, d) {
      const tr = lignes[i];
      if (!tr) return;
      tr.querySelector(".champ-nom").value = d.nom;
      // `span[data-champ]` et non `[data-champ]` tout court : les BOUTONS
      // portent eux aussi un `data-champ`. Un sélecteur trop large écrirait le
      // score à l'intérieur d'un bouton.
      tr.querySelector('span[data-champ="victoires"]').textContent =
        d.victoires;
      tr.querySelector('span[data-champ="points"]').textContent = d.points;
      majIntitules(tr, d.nom);
    }

    function ecrireDom(donnees) {
      donnees.forEach((d, i) => ecrireLigne(i, d));
    }

    function signaler(message) {
      if (!alerte) return;
      alerte.textContent = message;
      alerte.hidden = !message;
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

    /** Envoie l'état courant au stockage, en dégradant si ça échoue.
     *  Ne PAS avaler l'erreur en silence : l'utilisateur croirait sauvegarder
     *  alors que rien n'est écrit. */
    async function envoyer() {
      const donnees = lireDom();
      try {
        await stockage.sauver(donnees);
        signaler(avertissementPersistant);
      } catch (e) {
        if (stockage.nom === "distant") {
          stockage = creerStockageLocal();
          avertissementPersistant =
            "Base distante injoignable — scores conservés sur cet appareil seulement.";
          signaler(avertissementPersistant);
          try {
            await stockage.sauver(donnees);
          } catch (_) {
            /* le repli a échoué lui aussi : le message ci-dessus suffit */
          }
        } else {
          signaler(
            "Sauvegarde impossible sur cet appareil — notez les scores à la main.",
          );
        }
      }
    }

    function majDepuisDom() {
      // Le classement est recalculé TOUT DE SUITE (l'affichage doit être
      // instantané), l'écriture réseau est différée (elle peut attendre).
      classer(lireDom());
      clearTimeout(minuteurEcriture);
      minuteurEcriture = setTimeout(envoyer, DELAI_ECRITURE);
    }

    // --- Restauration -------------------------------------------------------
    // `async` : lire la base est une opération réseau. En attendant sa réponse,
    // le tableau reste affiché avec ses valeurs par défaut — jamais vide.
    (async () => {
      try {
        const propre = await stockage.charger();
        if (propre) ecrireDom(propre);
      } catch (e) {
        if (stockage.nom === "distant") {
          stockage = creerStockageLocal();
          avertissementPersistant =
            "Base distante injoignable — scores de cet appareil affichés.";
          signaler(avertissementPersistant);
          try {
            const secours = await stockage.charger();
            if (secours) ecrireDom(secours);
          } catch (_) {
            signaler(
              "Journal précédent illisible — reparti des valeurs par défaut.",
            );
          }
        } else {
          signaler(
            "Journal précédent illisible — reparti des valeurs par défaut.",
          );
        }
      }
      classer(lireDom());

      // Mise à jour en direct : quand un autre joueur clique, Supabase nous
      // pousse la ligne modifiée par WebSocket. Aucun rechargement de page.
      stockage.ecouter((ligne) => {
        const i = Number(ligne.id);
        const tr = lignes[i];
        if (!tr) return;
        // Si le curseur de l'utilisateur est DANS cette ligne (il est en train
        // de taper un nom), on ne la réécrit pas : sa frappe fait foi, et
        // remplacer la valeur d'un `<input>` en cours d'édition renvoie le
        // curseur à la fin du champ.
        if (tr.contains(document.activeElement)) return;
        ecrireLigne(i, assainirLigne(ligne, i));
        classer(lireDom());
      });
    })();

    // --- Interactions -------------------------------------------------------
    /* Un bouton ne touche QUE son propre compteur : le barème de la section VI
       dissocie victoires et points (une égalité vaut 1 point sans victoire).

       Un seul écouteur posé sur le tableau plutôt que 16 sur les boutons :
       c'est la délégation d'événement. L'événement remonte jusqu'ici, et
       `closest()` retrouve le bouton d'origine. */
    table.addEventListener("click", (e) => {
      const bouton = e.target.closest("button[data-champ]");
      if (!bouton) return;
      const cell = bouton
        .closest("tr")
        .querySelector(`span[data-champ="${bouton.dataset.champ}"]`);
      const valeur = Number(cell.textContent) + Number(bouton.dataset.pas);
      cell.textContent = Math.max(0, Math.min(MAX_POINTS, valeur));
      majDepuisDom();
    });

    table.addEventListener("input", (e) => {
      if (!e.target.classList.contains("champ-nom")) return;
      // Le nom vient de changer : les intitulés des quatre boutons de CETTE
      // ligne le citent, il faut les réécrire tout de suite (WCAG 4.1.2).
      const tr = e.target.closest("tr");
      majIntitules(tr, e.target.value.trim() || "Joueur");
      majDepuisDom();
    });

    const boutonReset = document.getElementById("reinitialiser");
    if (boutonReset) {
      boutonReset.addEventListener("click", () => {
        // La remise à zéro touche TOUT LE MONDE quand le stockage est partagé :
        // on demande confirmation avant de l'envoyer aux quatre joueurs.
        if (
          stockage.nom === "distant" &&
          !window.confirm(
            "Remettre le journal à zéro pour les quatre joueurs ? Cette action est partagée.",
          )
        ) {
          return;
        }
        ecrireDom(NOMS_DEFAUT.map((nom) => ({ nom, victoires: 0, points: 0 })));
        majDepuisDom();
      });
    }
  }

  initDiaporama();
  initJournal();
})();
