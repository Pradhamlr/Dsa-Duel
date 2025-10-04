# Use Node 20 slim for production
FROM node:20-slim

# Set working directory inside container
WORKDIR /app

# Install build tools
RUN apt-get update && \
    apt-get install -y build-essential curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose backend port
EXPOSE 5000

# Run migrations then start backend
CMD npx prisma migrate deploy && npm start
