#!/bin/sh
set -e

. /etc/walg-env.sh

RESTORE_DIR=$(mktemp -d)
CONTAINER_NAME="psikoport-restore-test-$$"

cleanup() {
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  rm -rf "$RESTORE_DIR"
}
trap cleanup EXIT

echo "Fetching latest backup into $RESTORE_DIR..."
wal-g backup-fetch "$RESTORE_DIR" LATEST

echo "Starting temporary PostgreSQL container for verification..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$RESTORE_DIR":/var/lib/postgresql/data \
  postgres:16

echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres; then
    echo "Restore verification PASSED."
    exit 0
  fi
  sleep 2
done

echo "Restore verification FAILED: PostgreSQL did not become ready." >&2
exit 1
