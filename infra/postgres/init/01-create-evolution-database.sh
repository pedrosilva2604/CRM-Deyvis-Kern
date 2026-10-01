#!/bin/sh
set -eu

: "${EVOLUTION_DATABASE_NAME:?defina EVOLUTION_DATABASE_NAME}"
: "${EVOLUTION_DATABASE_USER:?defina EVOLUTION_DATABASE_USER}"
: "${EVOLUTION_DATABASE_PASSWORD:?defina EVOLUTION_DATABASE_PASSWORD}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v crm_database="$POSTGRES_DB" \
  -v evolution_database="$EVOLUTION_DATABASE_NAME" \
  -v evolution_user="$EVOLUTION_DATABASE_USER" \
  -v evolution_password="$EVOLUTION_DATABASE_PASSWORD" <<'EOSQL'
CREATE ROLE :"evolution_user" LOGIN PASSWORD :'evolution_password';
CREATE DATABASE :"evolution_database" OWNER :"evolution_user";
REVOKE ALL ON DATABASE :"crm_database" FROM PUBLIC;
REVOKE ALL ON DATABASE :"evolution_database" FROM PUBLIC;
GRANT ALL ON DATABASE :"evolution_database" TO :"evolution_user";
EOSQL
