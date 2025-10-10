import * as emoji from "node-emoji";

// 🍀 -> `four_leaf_clover`
export const getUnicodeEmojiName = (emojiChar: string) =>
  emoji.which(emojiChar);
