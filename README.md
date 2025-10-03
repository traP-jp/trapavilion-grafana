# trapavilion-grafana

traPavilion Grafana企画

## セットアップ

```bash
docker compose up -d
```

Grafanaにアクセスする。ユーザーネームとパスワードは両方とも`admin`。

### Prometheusの設定

Data sources → Add data source → Prometheusを選択

- URL: `http://prometheus:9090`

### InfluxDBの設定

Data sources → Add data source → InfluxDBを選択

- URL: `http://influxdb:8086`
- InfraxDB Details
  - Database: `home`
  - User: `admin`
  - Password: `MyInitialAdminToken0==`
