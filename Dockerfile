FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Use relative API path in production ("/api")
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
ENV NODE_ENV=production
ENV PORT=8001
ENV MONGO_URL="mongodb://mongo:ibbjba5pzkmn7hvu@185.185.80.245:27028"
ENV DB_NAME="collab"
ENV JWT_SECRET="2132156231"
ENV ADMIN_EMAILS="admin@collab.com"
ENV EMAIL_ENABLED="false"

EXPOSE 8001

CMD ["node", "server.js"]
