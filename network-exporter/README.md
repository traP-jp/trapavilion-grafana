# speedtest exporter

## metrics

| name | content |
| --- | --- |
| `speedtest_download_bandwidth_bits_per_second` | ダウンロード帯域 (bit/s) |
| `speedtest_upload_bandwidth_bits_per_second` | アップロード帯域 (bit/s) |
| `speedtest_download_latency_seconds{stat="iqm|low|high|jitter"}` | ダウンロード遅延統計 (秒) |
| `speedtest_upload_latency_seconds{stat="iqm|low|high|jitter"}` | アップロード遅延統計 (秒) |
| `speedtest_ping_latency_seconds{stat="latency|low|high"}` | Ping レイテンシ統計 (秒) |
| `speedtest_ping_jitter_seconds` | Ping ジッタ (秒) |
| `speedtest_packet_loss_ratio` | パケットロス率 (%) |
| `speedtest_scrape_duration_seconds` | speedtest 実行に要した時間 (秒) |
| `speedtest_scrape_success` | 最新スクレイプの成功可否 (1=成功, 0=失敗) |
