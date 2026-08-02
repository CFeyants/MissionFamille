# 🚀 Missions en famille

Application web de missions et récompenses pour les enfants (thème fusée/espace).
Chaque enfant coche ses missions du jour, gagne des points, remplit sa fusée et
débloque des récompenses. Un **mode parents** protégé par code PIN permet de gérer
les missions, récompenses, pénalités et enfants.

Version portée depuis un artifact Claude vers une vraie app **Next.js** déployable
sur **Vercel**, avec stockage **partagé entre tous les appareils** grâce à
**Upstash Redis**.

---

## 🧱 Stack technique

- **Next.js 15** (App Router) + **React 19**
- **Upstash Redis** pour le stockage partagé (via l'API `/api/state`)
- Aucune base SQL, aucun compte utilisateur : un seul bloc de données JSON partagé

---

## 💻 Lancer en local

1. Installer les dépendances :
   ```bash
   npm install
   ```

2. Créer un fichier `.env.local` à la racine (voir `.env.example`) avec les
   identifiants d'une base Upstash Redis :
   ```bash
   UPSTASH_REDIS_REST_URL="https://xxxxx.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="xxxxxxxxxxxxxxxxxxxx"
   ```
   > Tu peux créer une base gratuite sur https://upstash.com (Redis).

3. Démarrer le serveur de développement :
   ```bash
   npm run dev
   ```
   Puis ouvrir http://localhost:3000

Le **code parents par défaut est `180586`** (modifiable via la variable
`NEXT_PUBLIC_PARENT_PIN`).

---

## ☁️ Déployer sur Vercel

### 1. Pousser le code sur GitHub

Le dépôt est déjà initialisé avec un premier commit. Il te reste à le relier à ton
dépôt GitHub `MissionFamille` :

```bash
git remote add origin https://github.com/<ton-compte>/MissionFamille.git
git branch -M main
git push -u origin main
```

### 2. Importer le projet dans Vercel

1. Va sur https://vercel.com → **Add New… → Project**
2. Importe le dépôt GitHub **MissionFamille**
3. Vercel détecte automatiquement Next.js — laisse les réglages par défaut

### 3. Ajouter la base Upstash Redis

1. Dans ton projet Vercel : onglet **Storage → Create Database → Upstash for Redis**
   (ou **Marketplace → Upstash**)
2. Connecte la base au projet : Vercel injecte automatiquement les variables
   `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`
3. **Redéploie** le projet pour que les variables soient prises en compte

### 4. (Optionnel) Changer le code parents

Dans **Settings → Environment Variables**, ajoute :
```
NEXT_PUBLIC_PARENT_PIN = <ton-code-à-6-chiffres>
```
puis redéploie.

---

## 📱 Astuce : installer sur une tablette/téléphone

Ouvre l'URL Vercel dans le navigateur, puis **« Ajouter à l'écran d'accueil »**.
L'app se lance en plein écran comme une vraie application.

> ⚠️ Les données sont partagées entre **tous** les appareils qui ouvrent le lien.
> Garde l'URL privée (famille uniquement).

---

## 📂 Structure

```
app/
  layout.jsx          → mise en page racine + métadonnées
  page.jsx            → toute l'application (client)
  api/state/route.js  → lecture/écriture du bloc de données dans Redis
public/
  manifest.webmanifest
reference/
  MissionFamille.artifact.tsx  → artifact Claude d'origine (référence)
```
