#!/bin/sh
set -eu

: "${API_UPSTREAM:?defina API_UPSTREAM (endereco interno da API, ex.: http://api:<PORT da API>)}"
: "${WEB_LISTEN_PORT:?defina WEB_LISTEN_PORT (porta em que o nginx escuta dentro do container, 1024 ou maior)}"
: "${WEB_LEAD_IMPORT_MAX_BODY_SIZE:?defina WEB_LEAD_IMPORT_MAX_BODY_SIZE (tamanho maximo da planilha de importacao, ex.: 11m)}"
: "${WEB_HSTS_MAX_AGE:?defina WEB_HSTS_MAX_AGE (segundos de HSTS; 0 enquanto o dominio nao tiver HTTPS)}"

case "$WEB_LISTEN_PORT" in
  ''|*[!0-9]*) echo "WEB_LISTEN_PORT precisa ser um numero" >&2; exit 1 ;;
esac
if [ "$WEB_LISTEN_PORT" -lt 1024 ]; then
  echo "WEB_LISTEN_PORT precisa ser 1024 ou maior: o nginx roda sem root" >&2
  exit 1
fi

case "$WEB_HSTS_MAX_AGE" in
  ''|*[!0-9]*) echo "WEB_HSTS_MAX_AGE precisa ser um numero de segundos" >&2; exit 1 ;;
esac
