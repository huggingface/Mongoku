FROM node:latest

ENV UID=991 GID=991

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
