# syntax=docker/dockerfile:1
#
# Frontend dev + verification image. Layered so that a source change does NOT
# re-resolve dependencies: only package.json / package-lock.json invalidate the
# `deps` layer.
#
# Stages:
#   deps  — node_modules from the lockfile, nothing else
#   test  — one-shot runner for `npm run test` / `npm run lint` (see build/docker-compose.test.yml)
#   dev   — vite dev server; LAST stage, so a plain `docker build` still yields the dev image
#
# The production image lives in build/Dockerfile.prod (nginx + static bundle).

ARG NODE_IMAGE=node:24-alpine

# ---------------------------------------------------------------- deps ------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------- test ------
FROM deps AS test
ENV CI=true
ENV NODE_ENV=development
WORKDIR /app
COPY . .
# Overridden per invocation (test / lint). Never a long-running process.
CMD ["npm", "run", "test"]

# ----------------------------------------------------------------- dev ------
FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
