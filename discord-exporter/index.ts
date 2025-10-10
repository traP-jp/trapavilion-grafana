import { startBot } from "./bot";
import { app } from "./server";

await startBot();

export default {
  fetch: app.fetch,
  hostname: "0.0.0.0",
};
