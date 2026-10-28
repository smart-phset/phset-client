#!/bin/sh
set -eu
node /app/scripts/validate-runtime-env.mjs
exec "$@"
