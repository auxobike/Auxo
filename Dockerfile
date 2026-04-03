FROM node:22-alpine

WORKDIR /app

COPY . .

RUN cd client && npm install && npm run build

RUN cd /app/server && npm install

WORKDIR /app/server

EXPOSE 8080

CMD ["node", "index.js"]
