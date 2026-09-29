#!/bin/sh
set -eu

: "${API_UPSTREAM:?defina API_UPSTREAM (endereco interno da API, ex.: http://api:<PORT da API>)}"
: "${WEB_LISTEN_PORT:?defina WEB_LISTEN_PORT (porta em que o nginx escuta dentro do container)}"
