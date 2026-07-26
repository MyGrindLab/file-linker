.RECIPEPREFIX := $(.RECIPEPREFIX)

network:
	docker network create linker

# ------------------------ Minio ------------------------

MINIO_COMPOSE_F := -f minio/docker-compose.yml
MINIO_ENV_F := --env-file minio/.env

start_minio:
	docker compose -p minio ${MINIO_ENV_F} ${MINIO_COMPOSE_F} up

startb_minio:
	docker compose -p minio ${MINIO_ENV_F} ${MINIO_COMPOSE_F} up --build

startd_minio:
	docker compose -p minio ${MINIO_ENV_F} ${MINIO_COMPOSE_F} up -d

down_minio:
	docker compose -p minio down

downv_minio:
	docker compose -p minio down -v

logs_minio:
	docker compose -p minio logs

# ------------------------ MongoDB ------------------------

MONGO_COMPOSE_F := -f mongodb/docker-compose.yml
MONGO_ENV_F := --env-file mongodb/.env

start_mongo:
	docker compose -p mongodb ${MONGO_ENV_F} ${MONGO_COMPOSE_F} up

startd_mongo:
	docker compose -p mongodb ${MONGO_ENV_F} ${MONGO_COMPOSE_F} up -d

down_mongo:
	docker compose -p mongodb down

downv_mongo:
	docker compose -p mongodb down -v

logs_mongo:
	docker compose -p mongodb logs

# ------------------------ Redis ------------------------

REDIS_COMPOSE_F := -f redis/docker-compose.yml

start_redis:
	docker compose -p redis ${REDIS_COMPOSE_F} up

startd_redis:
	docker compose -p redis ${REDIS_COMPOSE_F} up -d

down_redis:
	docker compose -p redis down

downv_redis:
	docker compose -p redis down -v

logs_redis:
	docker compose -p redis logs

# ------------------------ Prometheus ------------------------

PROMETHEUS_COMPOSE_F := -f prometheus/docker-compose.yml

start_prometheus:
	docker compose -p prometheus ${PROMETHEUS_COMPOSE_F} up

startd_prometheus:
	docker compose -p prometheus ${PROMETHEUS_COMPOSE_F} up -d

down_prometheus:
	docker compose -p prometheus down

downv_prometheus:
	docker compose -p prometheus down -v

logs_prometheus:
	docker compose -p prometheus logs
