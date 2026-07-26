# Create alias 
mc alias set minio http://localhost:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# Create user
mc admin user add minio ${MINIO_USER} ${MINIO_PASSWORD}

# Create bucket
mc mb minio/files

# Create and policy
mc admin policy create minio user-policy /minio/policy.json
mc admin policy attach minio user-policy --user ${MINIO_USER}

mc anonymous set download minio/files