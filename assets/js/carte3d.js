/* =============================================================================
   Le Reflux de Yarath-Maximal — maquette 3D du système des Étoiles Pâles
   -----------------------------------------------------------------------------
   Ce module dessine, dans un `<canvas>` WebGL, une maquette en volume du
   système décrit par `pages/carte3d.html`. Il est un BONUS : la référence reste
   le texte de la page — la liste des mondes et leurs fiches — qui tient sans
   script, sans réseau et au lecteur d'écran.

   TROIS RÈGLES QUI EXPLIQUENT TOUT LE FICHIER
   -------------------------------------------------------------------------
   1. UN CANVAS N'EST PAS ACCESSIBLE. Ce que WebGL dessine n'existe nulle part
      dans le DOM : ni le lecteur d'écran ni le clavier n'y ont accès. La toile
      est donc marquée `aria-hidden="true"` et TOUTE l'interaction passe par de
      vrais boutons HTML, listés dans la page. Le pointeur ne fait que doubler
      ce que les boutons permettent déjà. C'est la seule façon honnête de
      livrer de la 3D sans exclure personne.

   2. AUCUNE DONNÉE N'EST ÉCRITE ICI. Les noms, les résumés et les paramètres
      d'orbite sont lus dans les attributs `data-*` des boutons de la page. Le
      HTML reste la source unique — corriger une orbite dans le HTML suffit.

   3. RIEN N'EST GARANTI. WebGL peut être indisponible (vieux poste, pilote
      graphique désactivé) et le CDN de Three.js peut être filtré par le réseau
      du lycée. Dans les deux cas ce module ne s'exécute jamais, et le message
      de secours écrit en dur dans le HTML reste affiché : c'est pour cela
      qu'il est visible PAR DÉFAUT et masqué seulement ici, une fois la
      première image rendue.

   Chargé en `type="module"` : le code est différé d'office et `import` y est
   disponible. La résolution du nom « three » vient de l'`importmap` déclaré
   dans le `<head>` de la page.
   ============================================================================= */

import * as THREE from "three";

/* ---------------------------------------------------------------------------
   0. Les repères de la page
   ------------------------------------------------------------------------ */

const cadre = document.getElementById("scene3d-cadre");
const secours = document.getElementById("scene3d-secours");
const coucheEtiquettes = document.getElementById("scene3d-etiquettes");
const annonce = document.getElementById("scene3d-annonce");
const boutonsMondes = Array.from(document.querySelectorAll("[data-monde]"));

// Si la page n'est pas celle qu'on attend, on ne fait rien : ce module est
// chargé par une seule page, mais mieux vaut une sortie propre qu'une erreur.
if (cadre && coucheEtiquettes && boutonsMondes.length > 0) {
  demarrer();
}

function demarrer() {
  /* -------------------------------------------------------------------------
     1. Les corps du système, lus dans le HTML
     ----------------------------------------------------------------------
     Chaque bouton de la liste « Les mondes » porte ses paramètres :

       data-monde     identifiant court, sert de clé
       data-nom       nom affiché sur l'étiquette flottante
       data-orbite    rayon de l'orbite, en unités de la scène
       data-rayon     rayon du corps
       data-vitesse   vitesse angulaire (tour/seconde × 100)
       data-angle     position de départ sur l'orbite, en degrés
       data-teinte    couleur dominante, en hexadécimal
       data-eclat     couleur des lumières de surface (émission)
       data-relief    style de texture : forge, ruche, jungle ou fusion

     `dataset` renvoie toujours des CHAÎNES : d'où les `Number(...)`. Oublier
     cette conversion est l'erreur classique — « 14 » + 1 vaut « 141 ». */
  const mondes = boutonsMondes.map((bouton) => ({
    cle: bouton.dataset.monde,
    nom: bouton.dataset.nom || "",
    bouton,
    orbite: Number(bouton.dataset.orbite),
    rayon: Number(bouton.dataset.rayon),
    vitesse: Number(bouton.dataset.vitesse) / 100,
    angle: (Number(bouton.dataset.angle) * Math.PI) / 180,
    teinte: bouton.dataset.teinte,
    eclat: bouton.dataset.eclat,
    relief: bouton.dataset.relief,
    inclinaison: Number(bouton.dataset.inclinaison || 0),
  }));

  /* -------------------------------------------------------------------------
     2. Le moteur de rendu
     ----------------------------------------------------------------------
     `new THREE.WebGLRenderer()` LÈVE UNE EXCEPTION quand le navigateur ne sait
     pas créer de contexte WebGL. On l'attrape pour laisser le message de
     secours en place plutôt que de casser la page. */
  let rendu;
  const toile = document.createElement("canvas");
  toile.className = "scene3d-toile";
  // La toile est un dessin : elle ne doit rien annoncer au lecteur d'écran,
  // qui trouvera la même information dans les boutons et dans les fiches.
  toile.setAttribute("aria-hidden", "true");

  try {
    rendu = new THREE.WebGLRenderer({
      canvas: toile,
      antialias: true,
      alpha: false,
    });
  } catch (erreur) {
    console.warn("WebGL indisponible :", erreur);
    return; // le message de secours reste affiché
  }

  // `min(devicePixelRatio, 2)` : au-delà de 2, le gain visuel est nul et le
  // coût de calcul quadruple. Sur un écran de portable, c'est la différence
  // entre 60 images/seconde et un ventilateur qui s'emballe.
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  rendu.setClearColor(0x07060a, 1);
  cadre.insertBefore(toile, coucheEtiquettes);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 16 / 10, 0.5, 2000);

  /* -------------------------------------------------------------------------
     3. Les textures, fabriquées ici même
     ----------------------------------------------------------------------
     Aucun fichier image n'est téléchargé : chaque surface est peinte dans un
     `<canvas>` 2D hors écran, puis donnée à Three.js. La méthode tient en
     trois temps — un fond, des taches, un peu de bruit — et suffit largement à
     l'échelle où ces planètes sont vues.

     PIÈGE DU RACCORD : une texture de sphère est enroulée autour du globe, son
     bord droit touche son bord gauche. Toute tache posée près d'un bord doit
     donc être redessinée de l'autre côté, sinon une couture verticale apparaît
     sur le globe. C'est le rôle du `for (const decalage of ...)` plus bas. */

  /** Générateur pseudo-aléatoire À GRAINE : la même graine redonne la même
   *  planète à chaque chargement. Sans cela, la maquette changerait d'aspect à
   *  chaque rafraîchissement — joli une fois, déroutant ensuite.
   *  (Suite de Lehmer, suffisante pour du décor.) */
  function alea(graine) {
    let etat = graine % 2147483647;
    if (etat <= 0) etat += 2147483646;
    return () => {
      etat = (etat * 16807) % 2147483647;
      return (etat - 1) / 2147483646;
    };
  }

  /** Peint une planète. Renvoie deux textures : la surface éclairée par
   *  l'étoile (`carte`) et les lumières propres du monde (`lueur`), qui
   *  restent visibles sur la face nuit — fonderies, cité-ruche, coulées. */
  function peindreMonde({ teinte, eclat, relief, graine }) {
    const L = 512;
    const H = 256;
    const hasard = alea(graine);

    const fond = document.createElement("canvas");
    fond.width = L;
    fond.height = H;
    const s = fond.getContext("2d");

    const lumieres = document.createElement("canvas");
    lumieres.width = L;
    lumieres.height = H;
    const e = lumieres.getContext("2d");

    s.fillStyle = teinte;
    s.fillRect(0, 0, L, H);
    e.fillStyle = "#000000";
    e.fillRect(0, 0, L, H);

    // Bandes horizontales : ce qui donne à une planète son air de planète.
    // Amplitude faible, sinon on obtient un ballon de plage.
    for (let y = 0; y < H; y += 2) {
      const force = 0.06 * Math.sin(y * 0.09) + 0.04 * Math.sin(y * 0.021);
      s.fillStyle = force > 0 ? "#ffffff" : "#000000";
      s.globalAlpha = Math.abs(force);
      s.fillRect(0, y, L, 2);
    }
    s.globalAlpha = 1;

    // Taches de surface : continents, mers de poussière, nappes de jungle.
    const nombreTaches = relief === "jungle" ? 150 : 110;
    for (let i = 0; i < nombreTaches; i += 1) {
      const x = hasard() * L;
      const y = hasard() * H;
      const r = 8 + hasard() * (relief === "jungle" ? 46 : 34);
      const clair = hasard() > 0.5;
      for (const decalage of [-L, 0, L]) {
        const halo = s.createRadialGradient(
          x + decalage,
          y,
          0,
          x + decalage,
          y,
          r,
        );
        halo.addColorStop(0, clair ? "#ffffff" : "#000000");
        halo.addColorStop(1, "rgba(0,0,0,0)");
        s.globalAlpha = 0.05 + hasard() * 0.1;
        s.fillStyle = halo;
        s.beginPath();
        s.arc(x + decalage, y, r, 0, Math.PI * 2);
        s.fill();
      }
    }
    s.globalAlpha = 1;

    // Les lumières propres. Leur forme dit le monde : des grappes serrées pour
    // une cité-ruche, des balafres pour un arsenal en fusion, des foyers épars
    // pour un monde-forge. La jungle n'en a pas — elle est morte.
    if (relief !== "jungle") {
      const foyers = relief === "ruche" ? 220 : relief === "fusion" ? 34 : 90;
      for (let i = 0; i < foyers; i += 1) {
        const x = hasard() * L;
        const y = 30 + hasard() * (H - 60);
        for (const decalage of [-L, 0, L]) {
          e.save();
          e.translate(x + decalage, y);
          e.fillStyle = eclat;
          e.globalAlpha = 0.35 + hasard() * 0.65;
          if (relief === "fusion") {
            // Balafres : des coulées, pas des villes.
            e.rotate(hasard() * Math.PI);
            e.fillRect(0, 0, 12 + hasard() * 60, 1 + hasard() * 2);
          } else if (relief === "ruche") {
            e.fillRect(0, 0, 1 + hasard() * 3, 1 + hasard() * 3);
          } else {
            e.beginPath();
            e.arc(0, 0, 1.5 + hasard() * 4, 0, Math.PI * 2);
            e.fill();
          }
          e.restore();
        }
      }
    }

    const carte = new THREE.CanvasTexture(fond);
    const lueur = new THREE.CanvasTexture(lumieres);
    // `SRGBColorSpace` : sans cette ligne, Three.js traite l'image comme des
    // valeurs linéaires et toutes les planètes ressortent délavées.
    carte.colorSpace = THREE.SRGBColorSpace;
    lueur.colorSpace = THREE.SRGBColorSpace;
    return { carte, lueur };
  }

  /* -------------------------------------------------------------------------
     4. L'étoile Yarath
     ----------------------------------------------------------------------
     Une naine blanche : petite, très chaude, et c'est elle qui éclaire tout le
     reste. Le halo est un `Sprite` — un plan qui fait toujours face à la
     caméra —, la seule façon simple d'obtenir une lueur crédible sans
     post-traitement. */
  const etoile = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xf4f2ff }),
  );
  scene.add(etoile);

  function textureHalo(couleur) {
    const t = document.createElement("canvas");
    t.width = 128;
    t.height = 128;
    const c = t.getContext("2d");
    const d = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    d.addColorStop(0, couleur);
    d.addColorStop(0.25, couleur.replace("1)", "0.45)"));
    d.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = d;
    c.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(t);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textureHalo("rgba(216,226,255,1)"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.setScalar(13);
  scene.add(halo);

  /* Éclairage. `decay: 2` est la décroissance physique de la lumière (en
     1/distance²) : à 40 unités de l'étoile, il faut une intensité de plusieurs
     milliers pour rester visible. L'ambiante n'est pas réaliste — dans le vide
     il n'y a pas de lumière ambiante — mais sans elle les faces nuit sont
     absolument noires, et une carte doit rester lisible. */
  scene.add(new THREE.PointLight(0xfff2e0, 5200, 0, 2));
  scene.add(new THREE.AmbientLight(0x6a7ba8, 0.68));

  /* -------------------------------------------------------------------------
     5. Les orbites, les mondes et leurs étiquettes
     ---------------------------------------------------------------------- */

  /** Une étiquette est un vrai élément HTML posé PAR-DESSUS la toile, pas du
   *  texte dessiné dans la 3D : le texte HTML reste net à tous les zooms,
   *  hérite des polices du site, et suit les réglages de taille du visiteur.
   *  La couche entière est `aria-hidden` (elle double les boutons). */
  function creerEtiquette(texte, classe) {
    const el = document.createElement("span");
    el.className = "scene3d-etiquette" + (classe ? " " + classe : "");
    el.textContent = texte;
    coucheEtiquettes.append(el);
    return el;
  }

  const etiquettes = []; // { element, position (Vector3), objet }

  function suivre(element, objet, decalageY = 0) {
    etiquettes.push({ element, objet, decalageY });
  }

  suivre(creerEtiquette("Yarath", "scene3d-etiquette--etoile"), etoile, -2.6);

  // Un anneau très fin par orbite. `RingGeometry` est plat : on le couche dans
  // le plan du système avec une rotation d'un quart de tour sur X.
  mondes.forEach((monde) => {
    const anneau = new THREE.Mesh(
      new THREE.RingGeometry(monde.orbite - 0.06, monde.orbite + 0.06, 180),
      new THREE.MeshBasicMaterial({
        color: monde.relief === "forge" ? 0xc9a227 : 0x4a4136,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: monde.relief === "forge" ? 0.5 : 0.35,
      }),
    );
    anneau.rotation.x = -Math.PI / 2;
    scene.add(anneau);

    const { carte, lueur } = peindreMonde({
      teinte: monde.teinte,
      eclat: monde.eclat,
      relief: monde.relief,
      graine: monde.cle.length * 7919 + monde.orbite * 31,
    });

    const corps = new THREE.Mesh(
      new THREE.SphereGeometry(monde.rayon, 48, 32),
      new THREE.MeshStandardMaterial({
        map: carte,
        emissiveMap: lueur,
        emissive: 0xffffff,
        emissiveIntensity: 1,
        roughness: 0.92,
        metalness: 0.05,
      }),
    );
    corps.rotation.z = 0.12; // une inclinaison d'axe, pour ne pas faire toupie
    scene.add(corps);

    // Anneau de désignation, masqué tant que le monde n'est pas sélectionné.
    const designation = new THREE.Mesh(
      new THREE.RingGeometry(monde.rayon * 1.5, monde.rayon * 1.68, 64),
      new THREE.MeshBasicMaterial({
        color: 0xf0d67a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    designation.visible = false;
    scene.add(designation);

    monde.corps = corps;
    monde.designation = designation;
    monde.etiquette = creerEtiquette(
      monde.nom,
      monde.relief === "forge" ? "scene3d-etiquette--enjeu" : "",
    );
    suivre(monde.etiquette, corps, -(monde.rayon * 2.1 + 1.2));

    // Le raycaster remontera jusqu'au monde depuis l'objet touché.
    corps.userData.monde = monde;
  });

  /* -------------------------------------------------------------------------
     6. La ceinture périphérique
     ----------------------------------------------------------------------
     500 cailloux ne peuvent pas être 500 objets : chacun coûterait un appel de
     dessin. `InstancedMesh` en fait UN SEUL, la carte graphique répétant la
     même forme avec une matrice différente. C'est la technique de base dès
     qu'on répète un objet, et elle vaut la peine d'être connue. */
  const NOMBRE_CAILLOUX = 520;
  const ceinture = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      color: 0x6b6055,
      roughness: 1,
      flatShading: true,
    }),
    NOMBRE_CAILLOUX,
  );
  {
    const hasard = alea(4242);
    const matrice = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const echelle = new THREE.Vector3();
    for (let i = 0; i < NOMBRE_CAILLOUX; i += 1) {
      const angle = hasard() * Math.PI * 2;
      const distance = 56 + hasard() * 7;
      position.set(
        Math.cos(angle) * distance,
        (hasard() - 0.5) * 3.2,
        Math.sin(angle) * distance,
      );
      rotation.set(hasard() * 6.28, hasard() * 6.28, hasard() * 6.28);
      quaternion.setFromEuler(rotation);
      const t = 0.14 + hasard() * 0.42;
      echelle.set(t, t * (0.6 + hasard() * 0.8), t);
      matrice.compose(position, quaternion, echelle);
      ceinture.setMatrixAt(i, matrice);
    }
  }
  scene.add(ceinture);
  suivre(
    creerEtiquette("Ceinture périphérique", "scene3d-etiquette--limite"),
    { position: new THREE.Vector3(0, 0.5, -60) },
    0,
  );

  /* -------------------------------------------------------------------------
     7. Les repères lointains
     ----------------------------------------------------------------------
     Des points hors du système : décor, ni cliquables ni sélectionnables. */

  /** Repère lointain : un point lumineux hors du système et son étiquette. */
  function repereLointain(nom, note, x, y, z, couleur) {
    const marque = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textureHalo(couleur),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    marque.position.set(x, y, z);
    marque.scale.setScalar(9);
    scene.add(marque);
    suivre(
      creerEtiquette(nom + " · " + note, "scene3d-etiquette--repere"),
      marque,
      -5,
    );
  }

  repereLointain(
    "Baal",
    "le plus long transit",
    -84,
    20,
    -34,
    "rgba(219,91,94,1)",
  );
  repereLointain("Nocturne", "2 sauts", -74, -22, 52, "rgba(90,168,127,1)");
  repereLointain(
    "Le Maelstrom",
    "voisin immédiat",
    40,
    12,
    -50,
    "rgba(148,117,202,1)",
  );

  // Fond d'étoiles : des points, pas des sphères. Une sphère par étoile serait
  // absurde ; `Points` dessine un pixel agrandi par sommet.
  {
    const hasard = alea(90210);
    const sommets = [];
    for (let i = 0; i < 1400; i += 1) {
      // Points répartis sur une sphère lointaine (méthode de l'angle cosinus,
      // qui évite l'entassement aux pôles d'un tirage naïf).
      const u = hasard() * 2 - 1;
      const theta = hasard() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const d = 620 + hasard() * 260;
      sommets.push(r * Math.cos(theta) * d, u * d, r * Math.sin(theta) * d);
    }
    const geometrie = new THREE.BufferGeometry();
    geometrie.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(sommets, 3),
    );
    scene.add(
      new THREE.Points(
        geometrie,
        new THREE.PointsMaterial({
          color: 0xbfc8e6,
          size: 2.1,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.75,
        }),
      ),
    );
  }

  /* -------------------------------------------------------------------------
     8. La caméra : coordonnées sphériques
     ----------------------------------------------------------------------
     La caméra ne se déplace pas librement : elle tourne autour d'une cible sur
     une sphère, décrite par trois nombres — distance, azimut (theta) et
     hauteur (phi). C'est ce que fait n'importe quel « orbit control », et le
     réécrire ici évite de télécharger un second fichier depuis le CDN.

     `phi` est borné entre 0,12 et 1,45 radian : au pôle exact, la direction
     « haut » de la caméra devient indéterminée et l'image bascule d'un coup. */
  const vueInitiale = { distance: 132, theta: 0.9, phi: 1.02 };
  const vue = { ...vueInitiale };
  const cible = new THREE.Vector3(0, 0, 0);
  const cibleVoulue = new THREE.Vector3(0, 0, 0);
  const PHI_MIN = 0.12;
  const PHI_MAX = 1.45;
  const DISTANCE_MIN = 12;
  const DISTANCE_MAX = 320;

  function placerCamera() {
    vue.phi = Math.min(PHI_MAX, Math.max(PHI_MIN, vue.phi));
    vue.distance = Math.min(DISTANCE_MAX, Math.max(DISTANCE_MIN, vue.distance));
    camera.position.set(
      cible.x + vue.distance * Math.sin(vue.phi) * Math.sin(vue.theta),
      cible.y + vue.distance * Math.cos(vue.phi),
      cible.z + vue.distance * Math.sin(vue.phi) * Math.cos(vue.theta),
    );
    camera.lookAt(cible);
  }

  /* -------------------------------------------------------------------------
     9. Sélection d'un monde
     ----------------------------------------------------------------------
     Un seul chemin de code pour les trois gestes possibles — clic sur le
     bouton, clic sur la planète, touche du clavier. Tout passe par
     `selectionner()`, donc l'affichage ne peut pas diverger de ce qui est
     annoncé. */
  let selection = null;

  function selectionner(monde, { annoncer = true } = {}) {
    selection = monde;
    mondes.forEach((m) => {
      const actif = m === monde;
      m.designation.visible = actif;
      // `aria-pressed` porte l'état : le lecteur d'écran l'annonce, et le CSS
      // s'appuie sur le même attribut. Une classe seule mentirait à l'un des
      // deux publics.
      m.bouton.setAttribute("aria-pressed", actif ? "true" : "false");
      m.etiquette.classList.toggle("est-designee", actif);
    });

    if (monde) {
      // La caméra se rapproche, mais ne colle pas : on garde le système
      // lisible autour du monde visé.
      vue.distance = Math.max(24, monde.rayon * 11);
      if (annoncer) {
        annonce.textContent =
          "Vue centrée sur " +
          monde.nom +
          ". " +
          (monde.bouton.dataset.resume || "");
      }
    } else {
      cibleVoulue.set(0, 0, 0);
      vue.distance = vueInitiale.distance;
      if (annoncer) annonce.textContent = "Vue d'ensemble du système.";
    }
  }

  boutonsMondes.forEach((bouton) => {
    const monde = mondes.find((m) => m.bouton === bouton);
    bouton.addEventListener("click", () => {
      // Un deuxième clic sur le même monde désélectionne : c'est le
      // comportement attendu d'un bouton à deux états.
      selectionner(selection === monde ? null : monde);
    });
  });

  /* -------------------------------------------------------------------------
     10. Le pointeur : rotation, zoom, clic sur une planète
     ----------------------------------------------------------------------
     Les `PointerEvent` couvrent souris, stylet et doigt d'un seul jeu
     d'écouteurs — plus besoin des trois familles `mouse*`, `touch*`, `MSPointer*`. */
  const pointeurs = new Map();
  let dernierePince = 0;
  let aGlisse = false;

  toile.addEventListener("pointerdown", (ev) => {
    toile.setPointerCapture(ev.pointerId);
    pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    aGlisse = false;
  });

  toile.addEventListener("pointermove", (ev) => {
    const precedent = pointeurs.get(ev.pointerId);
    if (!precedent) return;
    const dx = ev.clientX - precedent.x;
    const dy = ev.clientY - precedent.y;
    pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointeurs.size === 1) {
      if (Math.abs(dx) + Math.abs(dy) > 3) aGlisse = true;
      vue.theta -= dx * 0.006;
      vue.phi -= dy * 0.006;
    } else if (pointeurs.size === 2) {
      // Pincer pour zoomer : on compare l'écart entre les deux doigts d'une
      // image à l'autre.
      const [a, b] = Array.from(pointeurs.values());
      const ecart = Math.hypot(a.x - b.x, a.y - b.y);
      if (dernierePince > 0) vue.distance *= dernierePince / ecart;
      dernierePince = ecart;
      aGlisse = true;
    }
  });

  function relacher(ev) {
    pointeurs.delete(ev.pointerId);
    if (pointeurs.size < 2) dernierePince = 0;
  }
  toile.addEventListener("pointerup", relacher);
  toile.addEventListener("pointercancel", relacher);

  /* Molette. ON NE CONFISQUE PAS LE DÉFILEMENT DE LA PAGE : la molette ne
     zoome que si la maquette a le focus clavier (après un clic ou une
     tabulation dedans). Sinon on laisse passer l'événement, et la page défile
     comme partout ailleurs. Une page qui piège la molette est insupportable au
     visiteur qui voulait seulement descendre. */
  toile.addEventListener(
    "wheel",
    (ev) => {
      if (document.activeElement !== cadre) return;
      ev.preventDefault();
      vue.distance *= Math.exp(ev.deltaY * 0.0012);
    },
    { passive: false },
  );

  // Clic sur une planète. Le `raycaster` lance un rayon depuis la caméra à
  // travers le point cliqué et renvoie ce qu'il rencontre.
  const rayon = new THREE.Raycaster();
  const pointeurNormalise = new THREE.Vector2();

  function mondeSousLePointeur(ev) {
    const boite = toile.getBoundingClientRect();
    // Coordonnées normalisées : -1 à +1 sur chaque axe, origine au centre.
    pointeurNormalise.x = ((ev.clientX - boite.left) / boite.width) * 2 - 1;
    pointeurNormalise.y = -((ev.clientY - boite.top) / boite.height) * 2 + 1;
    rayon.setFromCamera(pointeurNormalise, camera);
    const touches = rayon.intersectObjects(
      mondes.map((m) => m.corps),
      false,
    );
    return touches.length > 0 ? touches[0].object.userData.monde : null;
  }

  toile.addEventListener("click", (ev) => {
    if (aGlisse) return; // on faisait tourner la vue, pas un clic
    const monde = mondeSousLePointeur(ev);
    if (monde) {
      selectionner(selection === monde ? null : monde);
      // Le focus rejoint le bouton correspondant : l'utilisateur au clavier
      // reprend la main là où l'action a eu lieu (WCAG 2.4.3).
      if (selection) selection.bouton.focus();
    }
  });

  toile.addEventListener("pointermove", (ev) => {
    if (pointeurs.size > 0) return;
    toile.style.cursor = mondeSousLePointeur(ev) ? "pointer" : "grab";
  });

  /* -------------------------------------------------------------------------
     11. Le clavier
     ----------------------------------------------------------------------
     Le cadre porte `tabindex="0"` : il est atteignable à la tabulation, et son
     `aria-label` annonce les touches disponibles. On n'intercepte QUE les
     touches qu'on utilise — toutes les autres (Tab en tête) doivent continuer
     à fonctionner, sinon on enferme l'utilisateur dans la maquette. */
  cadre.addEventListener("keydown", (ev) => {
    const pas = ev.shiftKey ? 0.24 : 0.08;
    let traitee = true;
    switch (ev.key) {
      case "ArrowLeft":
        vue.theta += pas;
        break;
      case "ArrowRight":
        vue.theta -= pas;
        break;
      case "ArrowUp":
        vue.phi -= pas * 0.6;
        break;
      case "ArrowDown":
        vue.phi += pas * 0.6;
        break;
      case "+":
      case "=":
        vue.distance *= 0.88;
        break;
      case "-":
        vue.distance /= 0.88;
        break;
      case "Home":
        reinitialiser();
        break;
      default:
        traitee = false;
    }
    if (traitee) ev.preventDefault();
  });

  /* -------------------------------------------------------------------------
     12. La barre d'outils
     ---------------------------------------------------------------------- */
  const boutonPause = document.getElementById("scene3d-pause");
  const boutonVue = document.getElementById("scene3d-reinit");
  const boutonDessus = document.getElementById("scene3d-dessus");
  const boutonPlus = document.getElementById("scene3d-plus");
  const boutonMoins = document.getElementById("scene3d-moins");

  /* WCAG 2.3.3 et 2.2.2 — le mouvement automatique doit pouvoir être arrêté,
     et il ne doit PAS démarrer si le visiteur a demandé moins d'animations
     dans son système. On lit la préférence au lieu de la supposer. */
  const moinsDeMouvement = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  let enMouvement = !moinsDeMouvement.matches;

  function majBoutonPause() {
    boutonPause.textContent = enMouvement
      ? "Suspendre les orbites"
      : "Animer les orbites";
    boutonPause.setAttribute("aria-pressed", enMouvement ? "false" : "true");
  }
  majBoutonPause();

  boutonPause.addEventListener("click", () => {
    enMouvement = !enMouvement;
    majBoutonPause();
  });

  function reinitialiser() {
    selectionner(null, { annoncer: false });
    vue.theta = vueInitiale.theta;
    vue.phi = vueInitiale.phi;
    vue.distance = vueInitiale.distance;
    annonce.textContent = "Vue d'ensemble du système, orientation d'origine.";
  }

  boutonVue.addEventListener("click", reinitialiser);
  boutonDessus.addEventListener("click", () => {
    vue.phi = PHI_MIN;
    vue.theta = 0;
    annonce.textContent = "Vue de dessus, plan des orbites.";
  });
  boutonPlus.addEventListener("click", () => {
    vue.distance *= 0.8;
  });
  boutonMoins.addEventListener("click", () => {
    vue.distance /= 0.8;
  });

  /* -------------------------------------------------------------------------
     13. Redimensionnement
     ----------------------------------------------------------------------
     `ResizeObserver` plutôt que l'événement `resize` de la fenêtre : le cadre
     peut changer de taille sans que la fenêtre bouge (barre latérale, zoom
     texte, rotation d'un téléphone). C'est le seul moyen fiable. */
  function redimensionner() {
    const l = cadre.clientWidth;
    const h = cadre.clientHeight;
    if (l === 0 || h === 0) return;
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
    rendu.setSize(l, h, false);
  }
  new ResizeObserver(redimensionner).observe(cadre);
  redimensionner();

  /* -------------------------------------------------------------------------
     14. La boucle de rendu
     ----------------------------------------------------------------------
     `setAnimationLoop` est la version Three.js de `requestAnimationFrame` :
     elle s'interrompt d'elle-même quand l'onglet passe en arrière-plan, ce qui
     évite de faire tourner une carte graphique pour personne. */
  const horloge = new THREE.Clock();
  let premiereImage = true;
  const positionProjetee = new THREE.Vector3();

  rendu.setAnimationLoop(() => {
    const delta = Math.min(horloge.getDelta(), 0.1);

    if (enMouvement) {
      mondes.forEach((monde) => {
        monde.angle += monde.vitesse * delta;
      });
      etoile.rotation.y += delta * 0.05;
    }

    // Position de chaque monde sur son orbite. L'inclinaison est appliquée en
    // Y : les orbites ne sont pas rigoureusement coplanaires, ce qui suffit à
    // donner du relief à l'ensemble.
    mondes.forEach((monde) => {
      const x = Math.cos(monde.angle) * monde.orbite;
      const z = Math.sin(monde.angle) * monde.orbite;
      monde.corps.position.set(x, Math.sin(monde.angle) * monde.inclinaison, z);
      if (enMouvement) monde.corps.rotation.y += delta * 0.25;
      monde.designation.position.copy(monde.corps.position);
      monde.designation.lookAt(camera.position);
    });

    if (selection) cibleVoulue.copy(selection.corps.position);

    // Amortissement : la caméra rejoint sa cible en douceur au lieu de sauter.
    // `1 - exp(-k·dt)` donne un amortissement indépendant du nombre d'images
    // par seconde — une simple multiplication par 0,1 accélérerait le
    // mouvement sur un écran à 144 Hz.
    const lissage = 1 - Math.exp(-6 * delta);
    cible.lerp(cibleVoulue, lissage);
    placerCamera();

    halo.position.copy(etoile.position);

    // Projection des étiquettes HTML. `project()` transforme un point 3D en
    // coordonnées écran normalisées ; z > 1 signifie « derrière la caméra ».
    const l = cadre.clientWidth;
    const h = cadre.clientHeight;
    etiquettes.forEach(({ element, objet, decalageY }) => {
      positionProjetee.copy(objet.position);
      positionProjetee.y += decalageY;
      positionProjetee.project(camera);
      const gauche = ((positionProjetee.x + 1) / 2) * l;
      const haut = ((-positionProjetee.y + 1) / 2) * h;
      // `z > 1` : le point est DERRIÈRE la caméra — sa projection existe mais
      // n'a aucun sens, elle réapparaîtrait à l'opposé de l'écran. On masque
      // aussi ce qui sort du cadre, sans quoi une étiquette resterait collée
      // au bord alors que le corps qu'elle nomme est hors champ.
      /* ON MASQUE AVEC `visibility`, PAS AVEC `hidden`. Un élément en
         `display: none` a une largeur de zéro : le test ci-dessous le croirait
         alors rentré dans le cadre, le réafficherait, mesurerait sa vraie
         largeur, le masquerait à nouveau… une étiquette clignotante à
         60 images par seconde. `visibility: hidden` conserve la largeur. */
      const demiLargeur = element.offsetWidth / 2;
      const dehors =
        positionProjetee.z > 1 ||
        gauche - demiLargeur < 0 ||
        gauche + demiLargeur > l ||
        haut < 8 ||
        haut > h - 8;
      element.classList.toggle("est-hors-champ", dehors);
      if (dehors) return;
      element.style.left = gauche + "px";
      element.style.top = haut + "px";
    });

    rendu.render(scene, camera);

    if (premiereImage) {
      premiereImage = false;
      // La maquette tourne : le message de secours n'a plus lieu d'être, et la
      // page peut annoncer que la vue est prête.
      if (secours) secours.hidden = true;
      cadre.classList.add("est-prete");
      toile.style.cursor = "grab";
    }
  });
}
