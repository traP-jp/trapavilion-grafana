import { type } from "arktype";

const Env = type({
  DISCORD_TOKEN: "string",
  DISCORD_CLIENT_ID: "string",
  DISCORD_GUILD_ID: "string",
  DISCORD_PHOTO_CHANNEL_ID: "string",
  DISCORD_ANNOUNCEMENT_CHANNEL_ID: "string",
});

const parsed = Env(process.env);
if (parsed instanceof type.errors) {
  throw new Error(`Invalid environment variables`);
}

export const typedEnv = parsed;
