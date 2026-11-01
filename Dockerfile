FROM node:20-alpine

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation en pur JavaScript (ultra rapide, pas de C++)
RUN npm install --omit=dev

# Copie du reste du projet
COPY . .

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]

