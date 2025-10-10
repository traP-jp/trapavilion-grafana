import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  MessageFlags,
} from "discord.js";
import { typedEnv } from "./env";
import {
  addMessageData,
  addPhotoData,
  addReactionData,
  type AnnouncementData,
  removeReactionData,
  setInitialData,
} from "./exporter";
import { getUnicodeEmojiName } from "./emoji";
import { addPhoto } from "./photo";

const getEmojiName = (emoji: string | null): string => {
  return emoji ? (getUnicodeEmojiName(emoji) ?? emoji) : "unknown";
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

const syncState = async () => {
  const guild = client.guilds.cache.get(typedEnv.DISCORD_GUILD_ID);
  if (guild === undefined) {
    throw new Error("Guild not found");
  }

  await guild.channels.fetch();

  const allMessages: Message<true>[] = [];

  await Promise.all(guild.channels.cache.map(async (channel) => {
    if (!channel.isTextBased()) return;
    if (!channel.viewable) return;

    const channelMessages: Message<true>[] = [];

    while (true) {
      console.log(
        `Fetching messages in channel #${channel.name}, current count: ${channelMessages.length}`,
      );

      const messages = await channel.messages.fetch({
        limit: 100,
        before: channelMessages.at(-1)?.id,
      });
      channelMessages.push(...messages.values());
      if (messages.size < 100) break;
    }

    allMessages.push(...channelMessages);
  }));

  console.log(allMessages.length);

  const messagesMap = new Map<string, number>();
  const reactionsMap = new Map<string, Map<string, number>>();
  const photosMap = new Map<string, number>();
  const announcements: AnnouncementData[] = [];

  for (const message of allMessages) {
    messagesMap.set(
      message.author.tag,
      (messagesMap.get(message.author.tag) ?? 0) + 1,
    );

    for (const reaction of message.reactions.cache.values()) {
      const emojiName = getEmojiName(reaction.emoji.name);
      console.log(
        `fetching reaction :${emojiName}: in message ${message.id}`,
      );

      let emojiReactionMap = reactionsMap.get(emojiName);
      if (emojiReactionMap === undefined) {
        emojiReactionMap = new Map<string, number>();
        reactionsMap.set(emojiName, emojiReactionMap);
      }
      const users = (await reaction.users.fetch()).values();
      for (const user of users) {
        emojiReactionMap.set(
          user.tag,
          (emojiReactionMap.get(user.tag) ?? 0) + 1,
        );
      }
    }

    if (message.channelId === typedEnv.DISCORD_ANNOUNCEMENT_CHANNEL_ID) {
      announcements.push({
        url: message.url,
        content: message.content,
        author: message.author.tag,
        date: message.createdAt,
        imageUrl: message.attachments.first()?.url,
      });
    }

    if (message.channelId === typedEnv.DISCORD_PHOTO_CHANNEL_ID) {
      if (message.attachments.size > 0) {
        photosMap.set(
          message.author.tag,
          (photosMap.get(message.author.tag) ?? 0) + message.attachments.size,
        );
        for (let i = 0; i < message.attachments.size; i++) {
          const attachment = message.attachments.at(i);
          if (attachment === undefined) continue;

          const content = message.content.length > 50
            ? `${message.content.slice(0, 50)}...`
            : message.content;
          let title = `${content} by ${message.author.tag}`;
          if (message.attachments.size > 1) {
            title += ` (${i + 1} / ${message.attachments.size})`;
          }
          addPhoto({
            id: attachment.id,
            title,
            width: attachment.width,
            height: attachment.height,
            url: attachment.url,
            createdAt: message.createdAt,
          });
        }
      }
    }
  }

  setInitialData({
    messages: Array.from(messagesMap, ([user, count]) => ({ user, count })),
    reactions: Array.from(
      reactionsMap,
      ([emoji, userMap]) =>
        Array.from(userMap, ([user, count]) => ({ emoji, user, count })),
    ).flat(),
    photos: Array.from(photosMap, ([user, count]) => ({ user, count })),
    announcements,
  });

  console.log("State synced");
};

export const startBot = async () => {
  client.on(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}!`);

    syncState();
  });

  client.on(Events.MessageCreate, async (message) => {
    addMessageData({ user: message.author.tag, count: 1 });

    if (message.channelId === typedEnv.DISCORD_ANNOUNCEMENT_CHANNEL_ID) {
      const announcement: AnnouncementData = {
        url: message.url,
        content: message.content,
        author: message.author.tag,
        date: message.createdAt,
        imageUrl: message.attachments.first()?.url,
      };
      console.log("New announcement:", announcement);
    }

    if (
      message.channelId === typedEnv.DISCORD_PHOTO_CHANNEL_ID &&
      message.attachments.size > 0
    ) {
      addPhotoData({
        user: message.author.tag,
        count: message.attachments.size,
      });
      for (let i = 0; i < message.attachments.size; i++) {
        const attachment = message.attachments.at(i);
        if (attachment === undefined) continue;

        const content = message.content.length > 50
          ? `${message.content.slice(0, 50)}...`
          : message.content;
        let title = `${content} by ${message.author.tag}`;
        if (message.attachments.size > 1) {
          title += ` (${i + 1} / ${message.attachments.size})`;
        }

        addPhoto({
          id: attachment.id,
          title,
          width: attachment.width,
          height: attachment.height,
          url: attachment.url,
          createdAt: message.createdAt,
        });
      }
    }
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        console.error("Something went wrong when fetching the message:", error);
        return;
      }
    }

    if (user.partial) {
      try {
        user = await user.fetch();
      } catch (error) {
        console.error("Something went wrong when fetching the user:", error);
        return;
      }
    }

    const emojiName = getEmojiName(reaction.emoji.name);
    addReactionData({ user: user.tag, emoji: emojiName, count: 1 });
    console.log(
      `Reaction added: :${emojiName}: by ${user.tag} on message ${reaction.message.id}`,
    );
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        console.error("Something went wrong when fetching the message:", error);
        return;
      }
    }
    if (user.partial) {
      try {
        user = await user.fetch();
      } catch (error) {
        console.error("Something went wrong when fetching the user:", error);
        return;
      }
    }
    const emojiName = getEmojiName(reaction.emoji.name);
    removeReactionData({ user: user.tag, emoji: emojiName, count: 1 });
    console.log(
      `Reaction removed: :${emojiName}: by ${user.tag} on message ${reaction.message.id}`,
    );
  });

  await client.login(typedEnv.DISCORD_TOKEN);
};
