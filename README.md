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

## Lancer en développement
Installer dépendances:
```
npm install
```
Démarrer:
```
npm run dev
```
Ouvrir l'URL locale dans un navigateur compatible WebXR (Chrome, Edge). Activer un casque VR.

## Déploiement GitHub Pages (CI)
Un workflow GitHub Actions est fourni: `.github/workflows/ci-pages.yml`.

Étapes:
1. Créer le dépôt sur GitHub et pousser la branche `main`.
2. Aller dans Settings > Pages > Build and deployment: sélectionner "GitHub Actions".
3. Le prochain push sur `main` lancera le build et déploiera `dist/`.

`vite.config.js` ajuste automatiquement `base` selon le nom du dépôt:
- Si le repo est `tonuser.github.io` → base `/`.
- Sinon → `/nom-du-repo/`.

Pour un domaine personnalisé ou un sous-répertoire différent, édite `vite.config.js` (clé `base`).

### Test build local
```
npm run build
npx serve dist   # ou npx http-server dist
```


## Licence
Prototype éducatif.
