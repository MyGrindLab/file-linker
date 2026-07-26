.RECIPEPREFIX := $(.RECIPEPREFIX)

# ------------------------ Frontend ------------------------

COMPOSE_F := -f build/docker-compose.yml
DOCKERFILE_F := -f build/Dockerfile
BASE_TAG := file-linker-frontend:local

base_build:
	docker build -t {BASE_TAG} ${DOCKERFILE_F} .

start:
	docker compose -p linker-frontend ${COMPOSE_F} up

startb: build
	docker compose -p linker-frontend ${COMPOSE_F} up --build

startd:
	docker compose -p linker-frontend ${COMPOSE_F} up --detach

down:
	docker compose -p linker-frontend ${COMPOSE_F} down

downv:
	docker compose -p linker-frontend ${COMPOSE_F} down -v

restart:
	docker compose -p linker-frontend ${COMPOSE_F} down
	docker compose -p linker-frontend ${COMPOSE_F} up --detach

logs:
	docker logs -f linker-frontend