FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps \
  && npm install --no-save --legacy-peer-deps ajv@^8 ajv-keywords@^5
COPY frontend/ ./

# Frontend build-time API base URL
ARG REACT_APP_BACKEND_URL="http://colaboreaza.ro/api"
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
RUN npm run build

FROM node:20-alpine AS backend-runtime

WORKDIR /app/backend

# Install production dependencies first for better Docker layer caching
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into final image
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Runtime environment variables (set real values in Dockploy)
# Required in Dockploy: MONGO_URL, DB_NAME, JWT_SECRET
# Optional in Dockploy: ADMIN_EMAILS, EMAIL_ENABLED
ENV MONGO_URL=mongodb://mongo:ibbjba5pzkmn7hvu@185.185.80.245:27028
ENV NODE_ENV=production
ENV JWT_SECRET=gfgdgdfgdf
ENV DB_NAME=collab
ENV PORT=8001
ENV EMAIL_ENABLED="false"

EXPOSE 8001

CMD ["node", "server.js"]
