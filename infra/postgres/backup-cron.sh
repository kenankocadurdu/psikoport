#!/bin/sh
set -e

. /etc/walg-env.sh

wal-g backup-push "$PGDATA"
wal-g delete retain FULL 30 --confirm
