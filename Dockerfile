FROM node:22-alpine

ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

WORKDIR /app

COPY . .

RUN cd client && npm install && npm run build

RUN cd /app/server && npm install

WORKDIR /app/server

EXPOSE 8080

CMD ["node", "index.js"]
