#!/bin/sh

projects_root="/Users/c.hill/Documents/Projects"
n8n_env_file="$projects_root/.secrets/n8n.env"

if [ ! -r "$n8n_env_file" ]; then
  echo "Unable to read shared n8n environment file: $n8n_env_file" >&2
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
. "$n8n_env_file"
set +a

if [ -z "${N8N_BASE_URL:-}" ]; then
  echo "N8N_BASE_URL is missing from $n8n_env_file" >&2
  return 1 2>/dev/null || exit 1
fi

if [ -z "${N8N_API_KEY:-}" ]; then
  echo "N8N_API_KEY is not configured. Revoke the exposed key and store its replacement in $n8n_env_file." >&2
  return 1 2>/dev/null || exit 1
fi
