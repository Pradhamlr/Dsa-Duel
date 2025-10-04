# Use Node 20 slim
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of backend files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose backend port
EXPOSE 5000

# Run migrations then start backend
CMD npx prisma migrate deploy && npm start
