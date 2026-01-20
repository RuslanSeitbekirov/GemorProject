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
RUN apk add asio-dev
COPY --from=builder /app/build/build/Release/bin .
CMD ["./web_app"]