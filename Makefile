# Root Makefile — PARTIALLY WIRED.
#
# Wired today: the frontend targets (up-frontend, sh-frontend, test-frontend,
# lint-frontend, e2e). Everything still showing $(TODO) is not implemented and
# fails loudly rather than pretending to work — including test-backend and
# lint-backend, which means the aggregate `check` / `test` / `lint` targets
# fail until the backend half lands. The frontend gate is:
#     make test-frontend && make lint-frontend
#
# This file declares the *interface* the whole project is driven through. The
# target names are the agreed structure; a body is filled in once the component
# and its infrastructure exist. Every body still unfilled fails with a pointer
# rather than pretending to work.
#
# Contract for whoever fills it in — `devops` owns this file:
#   - Every target executes inside a container. No host toolchain, ever.
#   - Keep the target names below: the agents, the skills, and CI depend on them.
#   - `make check` must be exactly the gate CI runs.
#   - Each component stays independently runnable (`up-frontend`, `up-backend`).
#   - Add targets for new components the same way; don't work around this file.
#
# To fill in: define the variables below, then replace each $(TODO) with the
# real command.

TODO = @echo "Makefile: target '$@' is not filled in yet — see the header." && exit 1

## --- to define once infrastructure/ is scaffolded -------------------------------
# COMPOSE       := <compose invocation against the file(s) in infrastructure/>
# RUN           := <one-shot wrapper, e.g. $(COMPOSE) run --rm>
# BACKEND_TEST  := <backend test command, run in its container>
# BACKEND_LINT  := <backend lint command>
# BACKEND_FMT   := <backend format command>

## --- frontend (wired) ----------------------------------------------------
# Each component owns its compose files under <component>/build/. Until a
# root-level infrastructure/ compose exists, the root Makefile drives those
# per-component files directly — the interface (these target names) is what
# other agents and CI depend on, not the compose layout behind it.
NETWORK              := linker
FRONTEND_PROJECT     := linker-frontend
COMPOSE_FRONTEND     := docker compose -p $(FRONTEND_PROJECT) -f frontend/build/docker-compose.yml
COMPOSE_FRONTEND_TST := docker compose -p $(FRONTEND_PROJECT)-test -f frontend/build/docker-compose.test.yml
# One-shot runner: --rm so nothing is left behind, --build so a changed
# package-lock.json is picked up without a separate `make build`.
RUN_FRONTEND         := $(COMPOSE_FRONTEND_TST) run --rm --build frontend-test
FRONTEND_TEST        := npm run test
FRONTEND_LINT        := npm run lint
# FRONTEND_FMT  := <no formatter wired yet — prettier not in package.json>
FRONTEND_URL         := http://localhost:13000

.DEFAULT_GOAL := help
.PHONY: help up up-frontend up-backend down restart ps logs build rebuild \
        sh-frontend sh-backend test test-frontend test-backend e2e \
        lint lint-frontend lint-backend fmt check migrate clean network

help: ## Show available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## --- run ---------------------------------------------------------------

up: ## Start the full stack (detached)
	$(TODO)

up-frontend: network ## Start only the frontend and what it depends on
	$(COMPOSE_FRONTEND) up -d --build
	@echo "frontend: $(FRONTEND_URL)"

up-backend: ## Start only the backend and what it depends on
	$(TODO)

down: ## Stop the stack, keep volumes
	$(TODO)

restart: down up ## Restart the full stack

ps: ## Show container status
	$(TODO)

logs: ## Tail logs from all services (make logs S=<service> for one)
	$(TODO)

## --- build -------------------------------------------------------------

build: ## Build all images
	$(TODO)

rebuild: ## Rebuild all images from scratch
	$(TODO)

sh-frontend: ## Shell into the frontend container
	@if [ -n "$$($(COMPOSE_FRONTEND) ps -q file-linker-frontend 2>/dev/null)" ]; then \
	  $(COMPOSE_FRONTEND) exec file-linker-frontend sh; \
	else \
	  echo "frontend is not running — opening a one-shot container instead"; \
	  $(RUN_FRONTEND) sh; \
	fi

sh-backend: ## Shell into the backend container
	$(TODO)

## --- verify ------------------------------------------------------------

test: test-frontend test-backend ## Run every test suite

test-frontend: ## Run frontend tests in its container
	$(RUN_FRONTEND) $(FRONTEND_TEST)

test-backend: ## Run backend tests in its container
	$(TODO)

# Starts the frontend only. It joins the external `linker` network, and infra
# and the backend are brought up through their own component Makefiles
# (infrastructure/Makefile, backend/Makefile) onto that same network — so the
# browser hits a real stack without this target owning the whole stack.
# Then point the Playwright MCP at $(FRONTEND_URL).
e2e: up-frontend ## Bring the stack up for browser E2E (driven via the Playwright MCP)
	@echo "E2E target: $(FRONTEND_URL) — drive it with the Playwright MCP"
	@echo "backend/infra not included: run 'make -C infrastructure ...' and 'make -C backend ...' if the flow needs them"

lint: lint-frontend lint-backend ## Lint every component

lint-frontend:
	$(RUN_FRONTEND) $(FRONTEND_LINT)

lint-backend:
	$(TODO)

fmt: ## Format all code in place
	$(TODO)

check: lint test ## Full pre-PR gate — must be green before a PR is opened

## --- data --------------------------------------------------------------

migrate: ## Apply database migrations
	$(TODO)

clean: ## Stop everything and delete volumes (destroys local data)
	$(TODO)

## --- internal ----------------------------------------------------------

# The components share one external docker network so each can be started on
# its own and still reach the others. Creating it is idempotent.
network:
	@docker network inspect $(NETWORK) >/dev/null 2>&1 || docker network create $(NETWORK)
