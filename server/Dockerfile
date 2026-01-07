FROM node:22-alpine

# Install Docker CLI and shell utilities to interact with the host Docker socket
RUN apk add --no-cache \
    docker \
    bash \
    tar \
    gzip \
    pv \
    coreutils

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Make scripts executable
RUN chmod +x /app/scripts/*.sh

# Create necessary directories
RUN mkdir -p /app/backups

# Expose the API port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]