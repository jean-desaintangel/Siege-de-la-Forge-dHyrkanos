/* =============================================================================
   Configuration Supabase — journal de guerre (section VII)
   -----------------------------------------------------------------------------
   Remplacez les deux valeurs ci-dessous par celles de VOTRE projet Supabase.
   Elles se trouvent dans le tableau de bord Supabase :
       Project Settings → API Keys → « Project URL » et la clé publique,
       nommée « anon public » (anciens projets) ou « publishable »
       (projets créés depuis 2025, préfixe sb_publishable_).

   POURQUOI CES VALEURS PEUVENT ÊTRE PUBLIÉES SUR GITHUB.
   La clé « anon » n'est pas un mot de passe : c'est un identifiant public que
   n'importe quel visiteur peut lire dans l'onglet Réseau de son navigateur.
   Ce qui protège la base, c'est la RLS (Row Level Security) définie côté
   serveur : elle n'autorise que la lecture et la mise à jour des quatre lignes
   du journal. Voir SUPABASE.md.

   ⚠️ Ne JAMAIS écrire ici la clé « service_role » : elle ignore la RLS et donne
   les pleins pouvoirs sur toute la base.

   Tant que ce fichier contient encore « VOTRE-PROJET », le journal retombe
   automatiquement sur localStorage — le site reste fonctionnel.
   ============================================================================= */

window.CONFIG_SUPABASE = {
  url: "https://czlwutdjqjlyrfpnoscb.supabase.co",
  cleAnon: "sb_publishable_rMvhslF0hshPxVf6LiPFiw_9h8zGPsz",
};
