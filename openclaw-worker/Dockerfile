FROM node:18-alpine

WORKDIR /app

# Créer dossier pour persistance SQLite
RUN mkdir -p /app/data

# Copier package files
COPY package*.json ./

# Installer dépendances
RUN npm install

# Copier le code source local
COPY . .

# Exposer le port (Railway override avec $PORT)
EXPOSE 3000

# Healthcheck pour Railway
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Démarrer OpenClaw
CMD ["npm", "start"]
