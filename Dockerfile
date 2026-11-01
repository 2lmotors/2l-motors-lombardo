FROM node:20-bookworm-slim

# Installation des outils de compilation pour SQLite
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copie des dépendances
COPY package*.json ./
RUN npm install --production

# Copie du code source
COPY . .

# Création du dossier de données persistant pour la base SQLite
RUN mkdir -p /data
ENV DATA_DIR=/data
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]

