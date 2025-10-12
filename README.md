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

## Plugins

### Infinity

1. Administration > Plugins and data > Plugins から「Infinity」を選択し install する．(<http://localhost:3000/plugins/yesoreyeram-infinity-datasource>)
2. Connections > Data Source > Add new data source から「Infinity」を選択し「Save & Test」を実行する (<http://localhost:3000/connections/datasources/edit/ff0pbd4axzf28d>)

### Clock

検索して入れる

## 運用上の注意

### network-exporter

リクエストを送りすぎないように、10m毎にしています。状況に応じて調整してください。

### switchbot-exporter

`compose.yaml`に認証情報を入れる。

取り方はSwitchbotアプリのバージョン情報を数回タップすると出てくるメニューから。
