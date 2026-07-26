# File Linker — Infrastructure

Docker Compose setup for shared infrastructure services used by File Linker. All services run on the `linker` Docker network.

## Setup

Create the shared network once:

```bash
make network
```

## Services

### MinIO (S3-compatible object storage)

```bash
cp minio/.env.example minio/.env   # fill in credentials
make startd_minio                   # start on ports 9000 (API) + 9001 (console)
```

After starting, run the setup script inside the MinIO container to create the user, bucket, and policy:

```bash
docker exec -it minio bash /minio/setup.sh
```

MinIO console: `http://localhost:9001`

**Environment variables (`minio/.env`):**

| Variable | Description |
|---|---|
| `MINIO_ROOT_USER` | Root admin username |
| `MINIO_ROOT_PASSWORD` | Root admin password |
| `MINIO_USER` | App service account username |
| `MINIO_PASSWORD` | App service account password |

---

### MongoDB

```bash
cp mongodb/.env.example mongodb/.env   # fill in credentials
make startd_mongo                       # start on port 27017
```

**Environment variables (`mongodb/.env`):**

| Variable | Description |
|---|---|
| `MONGO_ROOT_USER` | Root admin username |
| `MONGO_ROOT_PASSWORD` | Root admin password |
| `MONGO_DB` | Database name (default: `file_linker`) |

**Connection string for the backend:**
```
mongodb://<MONGO_ROOT_USER>:<MONGO_ROOT_PASSWORD>@mongodb:27017/<MONGO_DB>?authSource=admin
```

---

### Prometheus

```bash
make startd_prometheus   # start on port 9090
```

Prometheus UI: `http://localhost:9090`

Prometheus scrapes the backend container at `file-linker:8080/api/metrics` on
the shared `linker` Docker network. Start the backend and Prometheus on the same
network before expecting the target to be healthy.

---

## All Make Targets

```bash
make network        # create the linker Docker network

make startd_minio   # start MinIO (detached)
make down_minio     # stop MinIO
make downv_minio    # stop MinIO + delete volume
make logs_minio     # stream MinIO logs

make startd_mongo   # start MongoDB (detached)
make down_mongo     # stop MongoDB
make downv_mongo    # stop MongoDB + delete volume
make logs_mongo     # stream MongoDB logs

make startd_redis   # start Redis (detached)
make down_redis     # stop Redis
make downv_redis    # stop Redis + delete volume
make logs_redis     # stream Redis logs

make startd_prometheus # start Prometheus (detached)
make down_prometheus   # stop Prometheus
make downv_prometheus  # stop Prometheus + delete volume
make logs_prometheus   # stream Prometheus logs
```
