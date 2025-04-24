FROM node:16-alpine

# Install Docker CLI to interact with the host Docker socket
RUN apk add --no-cache docker

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose the API port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]