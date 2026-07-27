.RECIPEPREFIX := $(.RECIPEPREFIX)

# ------------------------ Backend ------------------------

COMPOSE_F := -f build/docker-compose.yml
DOCKERFILE_F := -f build/Dockerfile
BASE_TAG := file-linker:local

base_build:
	docker build -t ${BASE_TAG} ${DOCKERFILE_F} .

start:
	docker compose -p linker ${COMPOSE_F} up

startb: base_build
	docker compose -p linker ${COMPOSE_F} up --build

startd:
	docker compose -p linker ${COMPOSE_F} up --detach

down:
	docker compose -p linker ${COMPOSE_F} down

downv:
	docker compose -p linker ${COMPOSE_F} down -v

restart:
	docker compose -p linker ${COMPOSE_F} down
	docker compose -p linker ${COMPOSE_F} up --detach

logs:
	docker logs -f linker

ruff: base_build
	docker run -it $(BASE_TAG) bash -c "ruff check ."

mypy: base_build
	docker run -it $(BASE_TAG) bash -c "mypy ."

test: base_build
	docker run -it $(BASE_TAG) bash -c "pytest"