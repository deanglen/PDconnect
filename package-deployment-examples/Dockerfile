# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S middleware -u 1001

WORKDIR /app

# Copy dependencies and source code
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=middleware:nodejs . .

# Remove development files
RUN rm -rf package-deployment-examples/ ADMIN_SETUP.md DEPLOYMENT_GUIDE.md .git/

# Set up non-root user
USER middleware

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

EXPOSE 5000

CMD ["npm", "start"]