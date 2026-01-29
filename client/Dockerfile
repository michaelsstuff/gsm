# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the React application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy the build output from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx configuration (direct, no template processing needed)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port only (HTTPS handled by Nginx Proxy Manager)
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]