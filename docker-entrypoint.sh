#!/bin/sh
set -e

# When mounted as a persistent volume (e.g. in Railway), /app/data is mounted as root:root.
# Ensure data directories exist and give ownership to the node user so SQLite and uploads work.
mkdir -p /app/data/uploads

if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data
  exec su-exec node "$@"
else
  exec "$@"
fi
