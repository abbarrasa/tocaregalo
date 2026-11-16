ARG PHP_BASE_IMAGE
ARG COMPOSER_IMAGE

FROM ${COMPOSER_IMAGE} AS composer_binary

FROM ${PHP_BASE_IMAGE} AS development

# Installation occurs only during a separately authorized image build (002:T2).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        tzdata \
        libicu-dev \
        libonig-dev \
        libzip-dev \
    && docker-php-ext-install -j"$(nproc)" intl mbstring pdo_mysql zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer_binary /usr/bin/composer /usr/local/bin/composer
COPY docker/php/development.ini /usr/local/etc/php/conf.d/tocaregalo.ini

WORKDIR /workspace/backend

# No Composer install, migrations, application scaffolding, or key generation here.
CMD ["php-fpm", "-F"]
