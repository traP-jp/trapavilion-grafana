# trapavilion-grafana

traPavilion Grafana企画

## セットアップ

```bash
docker compose up -d
```

Grafanaにアクセスする。ユーザーネームとパスワードは両方とも`admin`。

Prometheusとlokiは既に設定されている。

### InfluxDBの設定

Data sources → Add data source → InfluxDBを選択

- URL: `http://influxdb:8086`
- InfraxDB Details
  - Database: `home`
  - User: `admin`
  - Password: `MyInitialAdminToken0==`

必要に応じてInfluxDBのUIから設定を変更してください。
運用時に必要な操作がある場合は、ここに追記して頂けると助かります。

## ダッシュボードの追加

`dashboards`フォルダに適切なディレクトリを切ってJSONファイルを追加し、`dashboard-provisioning.yaml`に追記してください。
