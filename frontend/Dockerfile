FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json* ./
ARG NPM_FALLBACK_REGISTRY=https://mirror-npm.runflare.com
RUN npm install --registry=https://registry.npmjs.org --no-audit --no-fund \
      --fetch-retries=1 --fetch-timeout=30000 \
      --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000 \
    || { echo "Primary npm registry failed; retrying with ${NPM_FALLBACK_REGISTRY}"; \
         npm install --registry="${NPM_FALLBACK_REGISTRY}" --no-audit --no-fund \
           --fetch-retries=2 --fetch-timeout=60000; }
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
