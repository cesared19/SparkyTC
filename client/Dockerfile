# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-slim AS production

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public

# Set environment to production
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "run", "start"] 