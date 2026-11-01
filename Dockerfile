FROM node:24-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY prisma ./prisma

# Copy source code
COPY . .

# Generate the Prisma client (must run after the schema/source are copied so the
# generated client in src/generated/prisma always matches the schema)
RUN pnpm exec prisma generate

# Build the application
RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start:prod"]
