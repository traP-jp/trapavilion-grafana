import { Hono } from "hono";
import { exportToPrometheus, exportToRSS } from "./exporter";
import { cors } from "hono/cors";
import { getLatestPhotoId, getPhotoHTML } from "./photo";

export const app = new Hono();

app.use("*", cors());

app.get("/", (c) => c.text("Hello! This is Discord Exporter."));

app.get("/photos", (c) => {
    return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";
            margin: 0;
            padding: 0;
            height: 100vh;
            overflow: hidden;
            background-color: #181b1f;
        }
        .photos-container {
            display: flex;
            height: 100%;
            width: fit-content;
            overflow-x: hidden;
        }
        .photo-item {
            position: relative;
            height: 100%;
            box-sizing: border-box;
            overflow: hidden;
        }
        .photo-item img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
        }
        .photo-item figure {
            margin: 0;
            width: 100%;
            height: 100%;
        }
        .photo-item figcaption {
            position: absolute;
            bottom: 0;
            right: 0;
            width: auto;
            max-width: 100%;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            color: #fff;
            text-align: right;
            font-size: 0.8rem;
            padding: 0.25rem 0.5rem;
            box-sizing: border-box;
            word-break: break-word;
        }
    </style>
</head>
<body>
    <div class="photos-container">
        ${getPhotoHTML(10)}
    </div>
    <script>
        const latestId = "${getLatestPhotoId() ?? ""}";
        function checkLatestIdLoop() {
            fetch("/photos/latest-id?latestId=" + latestId)
                .then(res => res.json())
                .then(data => {
                    if ((data.latestId ?? "") !== latestId) {
                        location.reload();
                    } else {
                        setTimeout(checkLatestIdLoop, 2000);
                    }
                })
                .catch(() => setTimeout(checkLatestIdLoop, 2000));
        }
        checkLatestIdLoop();
    </script>
</body>
</html>
`);
});

app.get("/photos/latest-id", async (c) => {
    const reqLatestId = c.req.query("latestId");
    while (reqLatestId === getLatestPhotoId()) {
        await Bun.sleep(1000);
    }
    return c.json({ latestId: getLatestPhotoId() });
});

app.get("/metrics", (c) => {
    const metrics = exportToPrometheus();
    return c.text(metrics, 200, {
        "Content-Type": "text/plain; version=1.0.0",
    });
});

app.get("/rss.xml", (c) => {
    const rss = exportToRSS();

    return c.text(rss, 200, { "Content-Type": "application/rss+xml" });
});
