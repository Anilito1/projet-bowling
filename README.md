# WebVR Bowling (Prototype)

Prototype d'un jeu de bowling WebXR avec Three.js et Cannon-es (physique basique).

## Fonctionnalités implémentées
- Piste avec 10 quilles dynamiques (Cannon-es).
- Décor amélioré: piste texturée (wood procedural), gouttières visuelles, murs latéraux, panneau arrière, light spots, fog légère, repères au sol.
- Boule(s) de bowling lançables (clic souris OU prise / relâche via contrôleurs VR (prototype)).
- 3 niveaux de difficulté (facile / normal / difficile) modifiant:
  - Frottement apparent / stabilité latérale (dispersion du lancer)
  - Largeur effective des gouttières (gutter detection déclenche fin de lancer)
- Différents types de boules (poids, rayon, friction) sélectionnables.
- Détection chute (approximation: inclinaison > seuil) + score, strike & spare.
- Reset automatique après frame (1 frame unique, 2 lancers max ou strike immédiat).
- Placeholders audio (non encore spatialifiés) : throw / roll / pinFall / strike / spare.

## Prochaines étapes
1. Améliorer la prise en main VR (historique positions pour une vélocité plus précise, prise en main haptique).
2. Améliorer la physique des quilles (formes composées / convex hull, restitution fine, spin friction).
3. Spatialiser l'audio (Web Audio API + PannerNode / HRTF) + variation aléatoire pitch.
4. Actifs GLTF détaillés (quilles mesh haute qualité + textures PBR, boule, décor salle de bowling).
5. UI in-world (panneau 3D interactif) + pointeur laser des contrôleurs.
6. Particules (impact quilles, poussière piste), post-process (bloom léger, vignette, DOF subtil).
7. Multijoueur futur (WebRTC / WebSocket) + scoreboard.
8. Ajustements difficulté dynamiques (adaptation selon performance joueur).

## Lancer en développement (version 100% statique, sans Vite)
Ici tout fonctionne en modules ES natifs via un import map CDN.

Option 1: ouvrir directement `index.html` dans Chrome/Edge (désactive parfois certaines features WebXR hors contexte https).

Option 2 (recommandé): lancer un petit serveur local (http-server par ex.)
```
npm install --global http-server   # (si pas déjà)
http-server -c-1 -p 5173 .
```
Puis ouvrir http://localhost:5173/

OU en utilisant le script fourni:
```
npm run serve
```

## Déploiement GitHub Pages (sans build)
Le workflow charge simplement les fichiers tels quels (pas de bundling). L'import map `<script type="importmap">` dans `index.html` résout `three` & `cannon-es` via CDN.

Étapes:
1. Push sur la branche `master` ou `main` (workflow écoute les deux).
2. Action "CI & Deploy Pages" : copie les sources vers l'artifact.
3. GitHub Pages publie directement `index.html` à la racine.

Pour travailler hors ligne sans CDN, il suffira d'ajouter un dossier `vendor/` avec les modules et mettre à jour l'import map.


## Licence
Prototype éducatif.
