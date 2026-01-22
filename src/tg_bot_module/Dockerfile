FROM golang:1.25.5-alpine3.23
RUN apk add --no-cache socat
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o tg_core .
CMD socat TCP-LISTEN:6379,fork,reuseaddr TCP:redis_web:6379 & ./tg_core
