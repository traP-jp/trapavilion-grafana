import { Hono } from "hono";
import { exportToPrometheus, exportToRSS } from "./exporter";
import { cors } from "hono/cors";

export const app = new Hono();

app.use("*", cors());

app.get("/", (c) => c.text("Hello! This is Discord Exporter."));

app.get("/metrics", (c) => {
  const metrics = exportToPrometheus();
  return c.text(metrics, 200, { "Content-Type": "text/plain; version=1.0.0" });
});

app.get("/rss.xml", (c) => {
  const rss = exportToRSS();
  return c.text(rss, 200, { "Content-Type": "application/rss+xml" });
});
