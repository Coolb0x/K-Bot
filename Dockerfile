# syntax=docker/dockerfile:1

# Define the Node.js version to use
ARG NODE_VERSION=22.13.1

# Stage 1: Build the application
FROM node:${NODE_VERSION}-slim AS builder

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --link package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the application source code
COPY --link ./src ./src
COPY --link tsconfig.json ./

# Build the TypeScript application
RUN npm run build

# Stage 2: Prepare the production image
FROM node:${NODE_VERSION}-slim AS final

# Set the working directory
WORKDIR /app

# Copy the built application and necessary files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Create a non-root user and switch to it
RUN useradd -m appuser
USER appuser

# Expose the application port
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]
