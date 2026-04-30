# ── Soteria Frontend Dockerfile ──
# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm ci

# Pass API URL as build arg so VITE_API_URL is baked into the bundle
ARG VITE_API_URL=http://localhost:5001
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
