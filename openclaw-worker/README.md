# OpenClaw Worker

Instance OpenClaw complète pour Railway avec mémoire persistante SQLite.

## Architecture

```
Service Railway "openclaw-xxx"
├── OpenClaw Framework (via NPM)
├── SQLite Database (persistance mémoire agent)
├── Configuration ENV (Telegram + OpenAI)
└── Webhook Telegram auto-configuré
```

## Configuration requise (Variables d'environnement)

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token du bot Telegram | ✅ |
| `OPENAI_API_KEY` | Clé API OpenAI | ✅ |
| `WEBHOOK_URL` | URL du service (auto-générée) | ✅ |
| `DATABASE_URL` | SQLite DB path | `file:./data/openclaw.db` |
| `PORT` | Port serveur | `3000` |
| `SYSTEM_PROMPT` | Prompt système de l'agent | Optionnel |
| `OPENAI_MODEL` | Modèle OpenAI | `gpt-4o-mini` |

## Endpoints

- `GET /health` - Healthcheck pour Railway
- `POST /webhook/telegram` - Webhook pour messages Telegram

## Persistance

La base de données SQLite est stockée dans `/app/data/openclaw.db` et persistée via un volume Railway configuré dans `railway.toml`.

## Déploiement

Ce worker est déployé automatiquement via le `RailwayProvisioner` du SAAS principal qui pointe vers ce dossier avec `rootDirectory: "openclaw-worker"`.
