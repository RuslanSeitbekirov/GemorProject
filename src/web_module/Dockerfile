FROM alpine:3.23.2 AS builder

WORKDIR /app

RUN apk add --no-cache cmake g++ make git python3 py3-pip linux-headers
RUN pip3 install conan --break-system-packages

COPY . .

RUN conan profile detect --force
RUN conan install . --output-folder=build --build=missing
RUN cmake --preset conan-release
RUN cmake --build build/build/Release

FROM alpine:3.23.2
WORKDIR /app

RUN apk add --no-cache asio-dev netcat-openbsd bash

COPY --from=builder /app/build/build/Release/bin .

COPY wait-for-redis.sh /wait-for-redis.sh
RUN chmod +x /wait-for-redis.sh

CMD ["/wait-for-redis.sh", "redis_web", "6379", "./web_app"]
