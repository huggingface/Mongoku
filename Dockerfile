FROM node:latest

ENV UID=991 GID=991

ENV MONGOKU_DEFAULT_HOST="localhost:27017"
ENV MONGOKU_SERVER_PORT=3100
ENV MONGOKU_DATABASE_FILE="/tmp/mongoku.db"
ENV MONGOKU_COUNT_TIMEOUT=5000
ENV EXCLUDE_SEARCH_GLOB="{system*,v_*,tmp_*}"

RUN mkdir -p /app
WORKDIR /app

COPY ./package*.json /app/
RUN npm install

COPY app/package*.json /app/app/
RUN npm --prefix app install

COPY ./ ./

RUN npm run build
RUN npm run --prefix app build -- --prod 

EXPOSE 3100

LABEL description="MongoDB client for the web. Query your data directly from your browser. You can host it locally, or anywhere else, for you and your team."

CMD ["/app/docker-run.sh"]
