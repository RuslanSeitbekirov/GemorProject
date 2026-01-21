FROM golang:1.25.5-alpine3.23 AS builder

WORKDIR /app
COPY . .
RUN go build -o sql_module

FROM alpine:3.23.2
WORKDIR /app
COPY --from=builder /app/sql_module /app/

CMD ["./sql_module"]