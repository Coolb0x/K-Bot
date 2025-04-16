# syntax=docker/dockerfile:1

# Define the Node.js version to use
ARG NODE_VERSION=22.13.1 # Make sure this version is supported and desired

# Stage 1: Build the application
FROM node:${NODE_VERSION}-slim AS builder

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
# Copying these first leverages Docker cache effectively
COPY package.json package-lock.json ./

# Use BuildKit cache mount for faster npm install/ci runs
# npm ci is generally preferred in CI/build environments to ensure exact dependencies are installed
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy the application source code
COPY ./src ./src
COPY tsconfig.json ./

# Build the TypeScript application (compiles TS to JS, usually into ./dist)
RUN npm run build

# Stage 2: Prepare the production image
FROM node:${NODE_VERSION}-slim AS final

# Set the working directory
WORKDIR /app

# Copy production dependencies and built code from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json # Also copy package-lock.json if npm start needs it or for consistency
# Optional: Copy package-lock.json if needed by your start script or for auditing
# COPY --from=builder /app/package-lock.json ./package-lock.json

# Set environment variables for production
ENV NODE_ENV=production
# Optional: Adjust memory limit as needed. Default Cloud Run limits might suffice.
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV PORT=8080 # Cloud Run expects your app to listen on the PORT env variable

# Create a non-root user for security best practices
RUN adduser --disabled-password --gecos '' appuser # More secure and standard way to add a user
USER appuser

# Expose the port the application will listen on
# Note: Cloud Run provides the PORT environment variable (default 8080) which your app MUST listen on.
# This EXPOSE is more for documentation/local use.
EXPOSE 8080

# Define the command to run the application using the start script in package.json
# Ensure your package.json's "start" script correctly runs the compiled JS (e.g., "node dist/server.js")
# and listens on the port specified by the $PORT environment variable.
CMD ["npm", "start"]
