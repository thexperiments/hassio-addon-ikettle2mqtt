FROM node:lts-alpine
WORKDIR /app
COPY ./app/package*.json ./
RUN npm ci --only=production
COPY ./app/app.js .
CMD ["node", "app.js"]