# Habitude

Le suivi des tâches qui reviennent : chaque jour, chaque semaine, chaque mois, chaque année.

Chaque compte a ses habitudes et sa couleur. On peut donner à quelqu'un un droit de
**lecture** sur son suivi, et le retirer à tout moment — personne ne coche à la place
de personne.

## Ce que l'application sait faire

- Quatre rythmes : quotidien, hebdomadaire, mensuel, annuel.
- Deux façons de planifier : **n'importe quand dans la période**, ou **à date fixe**
  (certains jours de la semaine, le 15 du mois, le 3 mars). Une date fixe tombée dans un
  mois trop court recule au dernier jour du mois ; le 29 février devient le 28 les
  années communes.
- Deux façons de mesurer : *fait / pas fait*, ou un **objectif chiffré**
  (10 000 pas par jour, 3 fois par semaine).
- Le **planning mural** : douze mois en colonnes, trente-et-un jours en lignes.
  Les week-ends sont teintés, le jour même est encadré. Une case se coche et se décoche,
  y compris longtemps après coup.
- Les habitudes en retard et celles du jour remontent en haut de la page ; rien n'est
  notifié par le système, tout se lit à l'ouverture.

## Faire tourner l'application en local

Docker suffit — ni Node ni Python ne sont nécessaires sur la machine.

```bash
docker compose up --build
```

- Application : <http://localhost:8080>
- Documentation de l'API : <http://localhost:8080/api/docs>

Les migrations sont appliquées automatiquement au démarrage du conteneur `api`.

Pour repartir d'une base vide :

```bash
docker compose down -v && docker compose up --build
```

## Comment c'est construit

| Morceau | Choix |
| --- | --- |
| API | FastAPI, SQLAlchemy 2, Alembic, authentification JWT (`bcrypt` + `pyjwt`) |
| Base | PostgreSQL 16 |
| Interface | React 18, TypeScript, Vite, sans bibliothèque de composants |
| Distribution | une seule image Docker ; FastAPI sert l'interface et l'API |

Le `Dockerfile` à la racine construit l'interface avec Node, puis copie le résultat dans
l'image Python. FastAPI sert ces fichiers et laisse le routage des pages au navigateur.
Le navigateur ne parle donc qu'à une seule origine : pas de CORS à configurer, pas d'URL
d'API à injecter au moment du build, et rien à résoudre entre deux services.

> Le plan gratuit de Render n'inclut pas le réseau privé entre services. Un découpage
> interface / API y échoue avec `host not found in upstream` : c'est la raison de cette
> image unique.

### Le modèle de données

Une `entry` vaut **un jour, une habitude** — jamais une période. Les progrès
hebdomadaires, mensuels et annuels sont la somme des jours de la période concernée.
C'est ce qui permet à la fois les objectifs du type « 3 fois par semaine » et le
planning mural, avec une seule table.

La contrainte `unique (habit_id, occurred_on)` garantit qu'un jour réenregistré est
**remplacé** et non additionné.

## Déployer sur Render

`render.yaml` est un blueprint complet : une base PostgreSQL et un service web.

1. Pousser le dépôt sur GitHub.
2. Sur Render : **New → Blueprint**, puis sélectionner le dépôt.
3. Valider. `JWT_SECRET` est généré par Render et `DATABASE_URL` est câblée
   automatiquement.

La base et le service doivent rester dans la **même région** : le nom d'hôte interne de
Postgres (`dpg-…-a`) n'est résolu qu'entre ressources d'une même région. Les deux sont
sur `frankfurt` dans le blueprint. La région d'une base ne se change pas après coup — il
faut la supprimer et la recréer.

> Sur le plan gratuit, le service s'endort après quinze minutes sans trafic. La première
> visite après une pause met une trentaine de secondes à répondre.

## Structure

```
Dockerfile       construit l'interface, puis l'embarque dans l'image de l'API
backend/
  app/
    periods.py     arithmétique des périodes et des dates fixes
    services.py    état de chaque habitude, données du planning
    routers/       auth, habitudes, cercle de partage
  alembic/         migrations
frontend/
  src/
    components/    Planner (le planning mural), HabitRow, HabitForm
    pages/         Aujourd'hui, L'année, Mes habitudes, Mon cercle, Mon compte
    styles.css     les jetons de couleur et de typographie
```
