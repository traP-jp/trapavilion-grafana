# discord-exporter

## Quick Start

```sh
bun i
bun run index.ts
```

## Environmental Variables

```
DISCORD_TOKEN={{ discord bot token }}
DISCORD_CLIENT_ID={{ discord bot client id }}
DISCORD_GUILD_ID={{ target discord server id }}
DISCORD_PHOTO_CHANNEL_ID={{ target photo channel id }}
DISCORD_ANNOUNCEMENT_CHANNEL_ID={{ target announcement channel id }}
```

## for Prometheus / Grafana

expose `/metrics` for Prometheus and `/rss.xml` for Grafana RSS Feed
