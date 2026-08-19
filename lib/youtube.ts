import { ChatLogItem } from "./types";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export function extractVideoId(input: string) {
  const value = input.trim();
  if (!value) return "";

  try {
    const url = new URL(value);

    if (url.hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    const v = url.searchParams.get("v");
    if (v) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    const liveIndex = parts.indexOf("live");
    if (liveIndex >= 0 && parts[liveIndex + 1]) return parts[liveIndex + 1];

    const shortsIndex = parts.indexOf("shorts");
    if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];
  } catch {
    if (/^[A-Za-z0-9_-]{6,}$/.test(value)) return value;
  }

  return "";
}

async function youtubeFetch(path: string, params: URLSearchParams) {
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    throw new Error("YOUTUBE_API_KEY가 설정되지 않았습니다.");
  }

  params.set("key", key);

  const res = await fetch(`${YOUTUBE_API}/${path}?${params.toString()}`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.error?.errors?.[0]?.reason ||
      "YouTube API 호출에 실패했습니다.";
    throw new Error(message);
  }

  return data;
}

export async function getLiveInfo(videoUrl: string) {
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    throw new Error("올바른 YouTube 영상 URL 또는 영상 ID가 아닙니다.");
  }

  const params = new URLSearchParams({
    part: "snippet,liveStreamingDetails",
    id: videoId,
  });

  const data = await youtubeFetch("videos", params);
  const item = data.items?.[0];

  if (!item) {
    throw new Error("해당 YouTube 영상을 찾을 수 없습니다.");
  }

  const liveChatId = item.liveStreamingDetails?.activeLiveChatId;

  if (!liveChatId) {
    throw new Error("현재 활성화된 라이브 채팅을 찾을 수 없습니다.");
  }

  return {
    videoId,
    liveChatId,
    liveTitle: item.snippet?.title ?? "YouTube Live",
    channelTitle: item.snippet?.channelTitle ?? "",
  };
}

export async function getLiveChatMessages(
  liveChatId: string,
  pageToken?: string,
) {
  const params = new URLSearchParams({
    liveChatId,
    part: "snippet,authorDetails",
    maxResults: "200",
  });

  if (pageToken) params.set("pageToken", pageToken);

  const data = await youtubeFetch("liveChat/messages", params);

  const chats: ChatLogItem[] = (data.items ?? []).map((item: any) => ({
    messageId: item.id,
    authorName: item.authorDetails?.displayName ?? "Unknown",
    authorHandle:
      item.authorDetails?.channelId
        ? `@${item.authorDetails.channelId}`
        : undefined,
    authorChannelId: item.authorDetails?.channelId ?? undefined,
    isMember: Boolean(item.authorDetails?.isChatSponsor),
    isModerator: Boolean(item.authorDetails?.isChatModerator),
    text:
      item.snippet?.displayMessage ??
      item.snippet?.textMessageDetails?.messageText ??
      "",
    publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  }));

  return {
    chats,
    nextPageToken: data.nextPageToken ?? "",
    pollingIntervalMillis: Number(data.pollingIntervalMillis ?? 7000),
  };
}
