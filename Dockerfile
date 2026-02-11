# OpenClaw SaaS Platform
FROM node:20-bookworm

# Install build tools and dependencies for native modules
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    python3 \
    python3-pip \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (npm install car package-lock.json peut être absent)
RUN npm install

# Copy source code
COPY . .

# Create data directories (Railway persistent storage)
RUN mkdir -p /data/bots /data/logs /data/shared/openclaw

# Set environment
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
ENV BOTS_DIR=/data/bots
ENV LOGS_DIR=/data/logs
ENV SHARED_OPENCLAW=/data/shared/openclaw
ENV HOME=/root

# Expose port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start application
CMD ["node", "src/server.js"]
