export type ChatLogItem = {
  messageId: string;
  authorName: string;
  authorHandle?: string;
  authorChannelId?: string;
  isMember?: boolean;
  isModerator?: boolean;
  text: string;
  publishedAt: string;
  receivedAt: string;
};
