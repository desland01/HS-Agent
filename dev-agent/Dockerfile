# Home Service Dev Agent - Dockerfile for Railway
# This container runs the autonomous development agent 24/7

FROM node:20-slim

# Install git, gh CLI, and other dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    gnupg \
    procps \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Copy scripts
COPY scripts ./scripts
RUN chmod +x scripts/*.sh

# Build TypeScript
RUN npm run build

# Create directory for cloned repo
RUN mkdir -p /app/repo

# Create directory for persistent data (patterns, corrections)
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV WORKING_DIRECTORY=/app/repo
ENV DATA_DIR=/app/data

# Health check - verify the agent process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD pgrep -f "node dist/index.js" || exit 1

# Declare volume for persistent data (patterns, corrections, feedback)
# This will be mounted by Railway to persist learning across deployments
VOLUME ["/app/data"]

# Entrypoint script to setup repo and run agent
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
