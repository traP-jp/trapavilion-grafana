import RSS from "rss";

export interface AnnouncementData {
  url: string;
  content: string;
  author: string;
  date: Date;
  imageUrl?: string;
}

export interface MessageData {
  user: string;
  count: number;
}

export interface ReactionData {
  // e.g. "heart"
  emoji: string;
  // リアクションしたユーザー
  user: string;
  count: number;
}

export interface PhotoData {
  user: string;
  count: number;
}

interface ExportData {
  // 全メッセージ数
  messages: MessageData[];
  // 全リアクション数
  reactions: ReactionData[];
  // 写真チャンネルに投稿された写真数
  photos: PhotoData[];
  // お知らせチャンネルの投稿
  announcements: AnnouncementData[];
}

const exportData: ExportData = {
  messages: [],
  reactions: [],
  photos: [],
  announcements: [],
};

export const setInitialData = (data: ExportData) => {
  exportData.messages = data.messages;
  exportData.reactions = data.reactions;
  exportData.photos = data.photos;
  exportData.announcements = data.announcements;
};

export const addMessageData = (data: MessageData) => {
  const existing = exportData.messages.find((m) => m.user === data.user);
  if (existing) {
    existing.count += data.count;
  } else {
    exportData.messages.push(data);
  }
};

export const addReactionData = (data: ReactionData) => {
  const existing = exportData.reactions.find(
    (r) => r.user === data.user && r.emoji === data.emoji,
  );
  if (existing) {
    existing.count += data.count;
  } else {
    exportData.reactions.push(data);
  }
};

export const removeReactionData = (data: ReactionData) => {
  const existing = exportData.reactions.find(
    (r) => r.user === data.user && r.emoji === data.emoji,
  );
  if (existing) {
    existing.count -= data.count;
    if (existing.count <= 0) {
      exportData.reactions.splice(exportData.reactions.indexOf(existing), 1);
    }
  } else {
    console.error(
      `Trying to remove non-existing reaction data: ${data.emoji} by ${data.user}`,
    );
  }
};

export const addPhotoData = (data: PhotoData) => {
  const existing = exportData.photos.find((p) => p.user === data.user);
  if (existing) {
    existing.count += data.count;
  } else {
    exportData.photos.push(data);
  }
};

export const addAnnouncementData = (data: AnnouncementData) => {
  exportData.announcements.push(data);
};

export const exportToPrometheus = (): string => {
  let result = "";

  result += "# TYPE discord_messages_total counter\n";
  result +=
    "# HELP discord_messages_total Total number of messages sent by users\n";
  for (const message of exportData.messages) {
    result +=
      `discord_messages_total{user="${message.user}"} ${message.count}\n`;
  }

  result += "# TYPE discord_reactions_total counter\n";
  result +=
    "# HELP discord_reactions_total Total number of reactions added by users\n";
  for (const reaction of exportData.reactions) {
    result +=
      `discord_reactions_total{emoji="${reaction.emoji}",user="${reaction.user}"} ${reaction.count}\n`;
  }

  result += "# TYPE discord_photos_total counter\n";
  result +=
    "# HELP discord_photos_total Total number of photos posted by users\n";
  for (const photo of exportData.photos) {
    result += `discord_photos_total{user="${photo.user}"} ${photo.count}\n`;
  }
  if (exportData.photos.length === 0) {
    result += "discord_photos_total 0\n";
  }

  return result;
};

export function exportToRSS(): string {
  const feed = new RSS({
    title: "Discord Announcements",
    description: "Latest announcements from Discord",
    feed_url: "http://trapavilion-discord.trap.show/rss.xml",
    site_url: "http://trapavilion-discord.trap.show",
  });

  for (
    const announcement of exportData.announcements.toSorted(
      (a, b) => b.date.getTime() - a.date.getTime(),
    )
  ) {
    if (announcement.content.trim() === "") {
      continue;
    }

    const title =
      announcement.content.split("\n")[0]?.match(/^#+\s+(.*)/)?.[1] ??
        (announcement.content.split("\n").length === 1
          ? announcement.content
          : "no title");
    const description = title !== "no title"
      ? announcement.content.split("\n").slice(1).join("　")
      : announcement.content;

    feed.item({
      title,
      description: description || "(no content)",
      url: announcement.url,
      date: announcement.date,
      enclosure: announcement.imageUrl
        ? { url: announcement.imageUrl }
        : undefined,
      author: announcement.author,
    });
  }

  return feed.xml({ indent: true });
}
