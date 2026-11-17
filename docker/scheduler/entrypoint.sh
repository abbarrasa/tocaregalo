#!/bin/sh
set -eu
if [ ! -f bin/console ]; then
    printf '%s\n' 'No se encontró la consola de la aplicación.' >&2
    exit 2
fi
if [ "$#" -eq 0 ]; then
    set -- app:events:close-due --interval=15 --no-interaction
fi
exec php bin/console "$@"
