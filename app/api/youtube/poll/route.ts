import { NextResponse } from "next/server";
import { getLiveChatMessages, getLiveInfo } from "../../../../lib/youtube";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let liveChatId = String(body.liveChatId ?? "").trim();
    let liveTitle = String(body.liveTitle ?? "").trim();

    if (!liveChatId) {
      const videoUrl = String(body.videoUrl ?? "").trim();

      if (!videoUrl) {
        return NextResponse.json(
          { ok: false, message: "YouTube 라이브 URL을 입력하세요." },
          { status: 400 },
        );
      }

      const info = await getLiveInfo(videoUrl);
      liveChatId = info.liveChatId;
      liveTitle = info.liveTitle;
    }

    const result = await getLiveChatMessages(
      liveChatId,
      body.pageToken ? String(body.pageToken) : undefined,
    );

    return NextResponse.json({
      ok: true,
      liveChatId,
      liveTitle,
      nextPageToken: result.nextPageToken,
      pollingIntervalMillis: result.pollingIntervalMillis,
      totalMessages: result.chats.length,
      chats: result.chats,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "YouTube 채팅 수집 중 오류가 발생했습니다.";

    return NextResponse.json(
      {
        ok: false,
        message,
        retryable: !/quota|key|forbidden|permission/i.test(message),
      },
      { status: 500 },
    );
  }
}
