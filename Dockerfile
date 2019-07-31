FROM node:latest

ENV UID=991 GID=991

ENV MONGOKU_DEFAULT_HOST="localhost:27017"
ENV MONGOKU_SERVER_PORT=3100
ENV MONGOKU_DATABASE_FILE="/tmp/mongoku.db"
ENV MONGOKU_COUNT_TIMEOUT=5000

RUN mkdir -p /app
WORKDIR /app

COPY ./ /app

RUN npm install -g typescript @angular/cli \
      && npm install \
      && cd app \
      && npm install \
      && ng build --prod \
      && cd .. \
      && tsc

EXPOSE 3100

LABEL description="MongoDB client for the web. Query your data directly from your browser. You can host it locally, or anywhere else, for you and your team."


CMD ["/app/docker-run.sh"]
