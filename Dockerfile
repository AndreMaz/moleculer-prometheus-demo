FROM node:current-alpine

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

## Moleculer v0.14 needs Python to build event-loop-stats
RUN apk add --no-cache python3 make g++

RUN npm install --production

COPY . .

CMD ["npm", "start"]