# Journal de guerre partagé — mise en place de Supabase

Le journal de guerre (section VII d'`index.html`) était sauvegardé dans le
`localStorage` du navigateur : chaque joueur voyait ses propres scores et
personne ne voyait ceux des autres. Il est désormais rangé dans une base
PostgreSQL hébergée chez Supabase.

**Rien à installer, aucun serveur à écrire** : la page interroge la base
directement en HTTPS, et Supabase applique les règles de sécurité côté serveur.

Compter **10 minutes**. Les étapes 1 à 5 se font sur https://supabase.com,
l'étape 6 dans le dépôt.

---

## 1 · Créer le projet

1. Aller sur <https://supabase.com> → **Start your project** → se connecter
   (GitHub fait l'affaire).
2. **New project**.
   - _Name_ : `hyrkanos` (ou ce que vous voulez).
   - _Database Password_ : générer et **la garder** — elle ne sert pas à la
     page web, mais à un éventuel accès direct à Postgres.
   - _Region_ : `West EU (Ireland)` ou `Central EU (Frankfurt)`.
   - _Plan_ : **Free**.
3. Cliquer **Create new project** puis patienter ~2 minutes (la base se
   provisionne).

---

## 2 · Créer la table et ses règles de sécurité

Dans le menu de gauche : **SQL Editor** → **New query**. Coller ce bloc
entièrement, puis **Run**.

```sql
-- ─────────────────────────────────────────────────────────────────────
-- Table du journal de guerre : exactement quatre lignes, une par joueur.
-- ─────────────────────────────────────────────────────────────────────
create table public.journal_campagne (
  id        smallint primary key check (id between 0 and 3),
  nom       text        not null default 'Joueur'
                        check (char_length(nom) between 1 and 40),
  victoires smallint    not null default 0  check (victoires between 0 and 99),
  points    smallint    not null default 0  check (points    between 0 and 99),
  maj_le    timestamptz not null default now()
);

-- Les quatre lignes sont créées ICI, une fois pour toutes.
-- La page ne pourra que les MODIFIER, jamais en ajouter ni en supprimer.
insert into public.journal_campagne (id, nom) values
  (0, 'Raphaël'),
  (1, 'Jean'),
  (2, 'Thomas'),
  (3, 'Tristan');

-- ─────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security) — LE point important.
-- Sans elle, la clé publique donnerait un accès total en écriture ET en
-- suppression à toute la table. Activée sans aucune politique, elle
-- bloque tout. Une politique = une permission explicitement accordée.
-- ─────────────────────────────────────────────────────────────────────
alter table public.journal_campagne enable row level security;

-- Tout le monde peut LIRE le journal.
create policy "lecture publique"
  on public.journal_campagne
  for select
  to anon
  using (true);

-- Tout le monde peut MODIFIER une ligne existante...
create policy "mise a jour publique"
  on public.journal_campagne
  for update
  to anon
  using (true)
  with check (true);

-- ...et c'est TOUT. Aucune politique `for insert` ni `for delete` :
-- ces deux opérations restent donc interdites au grand public.

-- ─────────────────────────────────────────────────────────────────────
-- Diffusion temps réel : Supabase pousse chaque UPDATE aux navigateurs
-- connectés, par WebSocket. C'est ce qui met les scores à jour chez les
-- autres joueurs sans recharger la page.
-- ─────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.journal_campagne;
```

Un message vert **Success. No rows returned** confirme que tout est passé.

---

## 3 · Vérifier

Menu **Table Editor** → table `journal_campagne` : les quatre lignes doivent
être là, avec le cadenas « RLS enabled » à côté du nom de la table.

Menu **Database → Publications** → `supabase_realtime` : `journal_campagne`
doit y figurer.

---

## 4 · Récupérer les deux clés

Menu **Project Settings** (roue dentée) → **API**. Noter :

| Champ dans Supabase | Valeur à copier                           |
| ------------------- | ----------------------------------------- |
| **Project URL**     | `https://xxxxxxxxxxxx.supabase.co`        |
| **anon public**     | une longue chaîne commençant par `eyJ...` |

> **Ne jamais copier la clé `service_role` (ou `sb_secret_...`).** Elle est
> juste en dessous, elle ressemble à la clé publique, et elle **ignore la RLS**. Dans une page web
> publique, elle laisserait n'importe qui vider la base.

---

## 5 · (Optionnel) Restreindre les origines autorisées

Menu **Authentication → URL Configuration**, ou **Project Settings → API →
CORS** selon la version de l'interface : y déclarer
`https://jean-desaintangel.github.io` limite les appels aux pages servies
depuis GitHub Pages. Ce n'est pas une protection forte (un `curl` s'en moque),
mais cela évite qu'un autre site réutilise la base par mégarde.

---

## 6 · Renseigner les clés dans le dépôt

Ouvrir `assets/js/supabase-config.js` et remplacer les deux valeurs :

```js
window.CONFIG_SUPABASE = {
  url: "https://xxxxxxxxxxxx.supabase.co",
  cleAnon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
};
```

Puis committer et pousser :

```bash
git add assets/js/supabase-config.js assets/js/campagne.js index.html SUPABASE.md
git commit -m "Journal de guerre : persistance partagée via Supabase"
git push
```

GitHub Pages se met à jour en une minute environ.

---

## Vérifier que ça marche

1. Ouvrir le site, section **VII · Journal de guerre**.
2. Cliquer sur un « + ». Recharger la page (`F5`) : la valeur est conservée.
3. Ouvrir la même page dans une **fenêtre de navigation privée**, côte à côte.
   Cliquer dans l'une : l'autre se met à jour **toute seule**, en une seconde.
4. Dans Supabase, **Table Editor** : la ligne a bien changé, `maj_le` aussi.

---

## Si ça ne marche pas

Ouvrir la console du navigateur (`F12` → onglet **Console**) et lire le
bandeau rouge affiché sous le tableau.

| Symptôme                                          | Cause probable                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| « Base distante injoignable » dès le chargement   | URL ou clé fausse dans `supabase-config.js`, ou CDN Supabase bloqué       |
| Les scores s'affichent mais rien ne se sauvegarde | La politique `for update` n'a pas été créée — rejouer le SQL de l'étape 2 |
| `new row violates row-level security policy`      | Il manque le `with check (true)` dans la politique d'update               |
| Ça sauvegarde, mais l'autre fenêtre ne bouge pas  | La ligne `alter publication supabase_realtime …` n'a pas été jouée        |
| `relation "journal_campagne" does not exist`      | Le SQL a été lancé sur un autre projet que celui des clés                 |
| Tout marche en local, rien sur GitHub Pages       | CORS trop restrictif (étape 5) ou `supabase-config.js` non committé       |

---

## Ce que ça illustre en cours (BTS SIO)

- **Architecture** : `Backend as a Service` — la page parle directement à la
  base, il n'y a pas de PHP au milieu. Comparer avec un `api/scores.php` qui
  ferait la même chose : où est passée la logique de sécurité ?
- **Sécurité — la vraie leçon.** La clé est publique et assumée. La protection
  n'est _pas_ dans le secret de la clé mais dans les règles serveur (RLS). Le
  parallèle avec l'injection SQL est direct : dans les deux cas, **on ne fait
  jamais confiance au client**. Faire l'exercice : un étudiant tente
  `DELETE` sur la table depuis la console (`client.from('journal_campagne')
.delete().eq('id', 0)`) → la RLS refuse. Puis retirer la politique et
  recommencer.
- **Défense en profondeur** : les contraintes `check` sur les colonnes doublent
  les bornes appliquées en JavaScript. Un `curl` qui contourne la page se heurte
  quand même à Postgres.
- **Robustesse** : `assainirLigne()` re-valide tout ce qui revient de la base.
  Une donnée sortie de la mémoire du programme redevient une donnée non fiable.
- **Amélioration progressive** : trois niveaux de repli (base partagée →
  localStorage → HTML seul). Débrancher le Wi-Fi et recharger : le site marche
  encore.
- **Patron « stratégie »** : `creerStockageLocal()` et `creerStockageDistant()`
  exposent la même interface, le reste du code ignore lequel il utilise.
- **Temps réel** : WebSocket vs requêtes répétées (_polling_) — pourquoi
  l'un passe à l'échelle et pas l'autre.
