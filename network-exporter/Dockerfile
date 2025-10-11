FROM golang:1.25-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /out/speedtest-exporter

# no registry in ubuntu 24.04
FROM ubuntu:22.04 
RUN apt update && apt install -y curl
RUN curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash
RUN apt install -y speedtest

WORKDIR /app
COPY --from=builder /out/speedtest-exporter /app/network-exporter
EXPOSE 9801
CMD ["/app/network-exporter"]