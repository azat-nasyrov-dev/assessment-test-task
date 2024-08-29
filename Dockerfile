FROM node:16.3.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:16.3.0-alpine
WORKDIR /app
RUN adduser -D noroot
COPY --from=build /app/node_modules ./node_modules/
COPY --from=build /app/dist ./dist
COPY --chown=noroot:noroot . .
USER noroot
EXPOSE 3001
CMD ["node", "./dist/main.js"]
