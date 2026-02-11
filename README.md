# 🤖 OpenClaw SaaS

Plateforme de déploiement de bots IA multi-plateformes (Telegram, Discord, Slack).

## 🌐 URLs de l'application

| Environnement | URL |
|--------------|-----|
| Production | `https://votre-url.up.railway.app` |
| Dashboard | `/dashboard` |
| API | `/api` |
| Health | `/health` |

---

## 🚀 Déploiement Rapide

### 1. Variables d'environnement requises

```env
# Base de données (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Sécurité
JWT_SECRET=votre_jwt_secret_32_caracteres_min
ENCRYPTION_KEY=votre_cle_32_caracteres!!

# Configuration Railway
PORT=8080
NODE_ENV=production

# Optionnel - pour déploiement auto des bots
RAILWAY_API_TOKEN=votre_token_railway
RAILWAY_PROJECT_ID=votre_project_id
RAILWAY_ENVIRONMENT_ID=votre_env_id
```

### 2. Déploiement sur Railway

1. Connecter le repo GitHub à Railway
2. Configurer les variables d'environnement
3. Deploy

---

## 📁 Structure du projet

```
.
├── src/                    # Code source backend (Node.js/Express)
│   ├── config/            # Configuration DB, constants
│   ├── controllers/       # Logique métier
│   ├── middleware/        # Auth, rate limiting
│   ├── models/            # Models DB (User, Bot)
│   ├── routes/            # Routes API
│   ├── services/          # RailwayProvisioner, BotManager
│   └── server.js          # Point d'entrée
│
├── public/                 # Frontend (HTML/CSS/JS)
│   ├── index.html         # Landing page
│   ├── dashboard.html     # Dashboard utilisateur
│   └── admin.html         # Panel admin
│
├── openclaw-worker/       # Worker pour les bots
│   ├── Dockerfile         # Build l'instance bot
│   ├── index.js           # Code du bot OpenClaw
│   ├── package.json
│   └── railway.toml       # Config Railway worker
│
├── Dockerfile             # Build le dashboard
├── railway.toml           # Config Railway dashboard
└── package.json           # Dépendances
```

---

## 🧪 Utilisateur de test

Pour tester rapidement :

```bash
# Créer l'utilisateur test
curl -X POST https://votre-url/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@openclaw.dev","password":"test123","name":"Test User"}'

# Puis modifier en plan BUSINESS (10 bots) via SQL
```

---

## 🔧 Architecture

### Flow de création de bot

```
1. User crée un bot dans le dashboard
2. Bot sauvegardé en base de données
3. RailwayProvisioner déploie un service
4. openclaw-worker démarre avec les credentials
5. Webhook Telegram configuré automatiquement
```

### Technologie

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: HTML vanilla, Tailwind CSS
- **Worker**: OpenClaw framework, SQLite (mémoire)
- **Hébergement**: Railway (auto-scaling)

---

## 📝 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/bots` | Liste des bots |
| POST | `/api/bots` | Créer un bot |
| POST | `/api/bots/:id/start` | Démarrer un bot |
| POST | `/api/bots/:id/stop` | Arrêter un bot |

---

## 🐛 Dépannage

### "Not Authorized" Railway
Le token Railway est invalide ou expiré. Utilisez le mode Mock (déploiement manuel).

### Bot créé mais pas déployé
Le déploiement Railway automatique nécessite un token valide. Sinon, déployez manuellement.

### Base de données inaccessible
Vérifiez que `DATABASE_URL` est correctement configuré.

---

## 📄 Licence

MIT
