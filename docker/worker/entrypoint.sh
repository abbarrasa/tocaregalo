#!/bin/sh
set -eu
if [ ! -f bin/console ]; then
    printf '%s\n' 'No se encontró la consola de la aplicación.' >&2
    exit 2
fi
if [ "$#" -eq 0 ]; then
    set -- messenger:consume notifications --time-limit=3600 --memory-limit=128M --no-interaction
fi
exec php bin/console "$@"
