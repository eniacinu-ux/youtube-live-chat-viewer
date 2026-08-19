"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatLogItem } from "../lib/types";

const MIN_POLL_MS = 3000;
const ERROR_RETRY_MS = 30000;

function normalize(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Page() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("YouTube 라이브 링크를 입력하세요.");
  const [liveTitle, setLiveTitle] = useState("");
  const [chats, setChats] = useState<ChatLogItem[]>([]);
  const [search, setSearch] = useState("");
  const [newChatIds, setNewChatIds] = useState<Set<string>>(new Set());

  const knownChatIdsRef = useRef<Set<string>>(new Set());
  const initializedChatsRef = useRef(false);
  const runningRef = useRef(false);
  const liveChatIdRef = useRef("");
  const pageTokenRef = useRef("");
  const liveTitleRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reversedChats = useMemo(() => [...chats].reverse(), [chats]);

  const searchedChats = useMemo(() => {
    const keyword = normalize(search);
    if (!keyword) return [];

    return [...chats]
      .filter(chat => {
        const name = normalize(chat.authorName ?? "");
        const handle = normalize(chat.authorHandle ?? "");
        const channelId = normalize(chat.authorChannelId ?? "");
        return (
          name.includes(keyword) ||
          handle.includes(keyword) ||
          channelId.includes(keyword)
        );
      })
      .reverse();
  }, [chats, search]);

  const matchedUser = searchedChats[0]
    ? searchedChats[0].authorName
    : search.trim();


  function scheduleNext(delay: number) {
    if (!runningRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(
      pollYoutube,
      Math.max(delay, MIN_POLL_MS),
    );
  }

  async function pollYoutube() {
    if (!runningRef.current) return;

    try {
      const res = await fetch("/api/youtube/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveChatId: liveChatIdRef.current || undefined,
          pageToken: pageTokenRef.current || undefined,
          liveTitle: liveTitleRef.current || undefined,
          videoUrl: liveChatIdRef.current
            ? undefined
            : youtubeUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data.retryable === false) {
          runningRef.current = false;
          setRunning(false);
          setStatus(data.message ?? "채팅 수집을 중단했습니다.");
          return;
        }

        setStatus(
          `${data.message ?? "수집 오류"} · 30초 뒤 자동 재시도`,
        );
        scheduleNext(ERROR_RETRY_MS);
        return;
      }

      liveChatIdRef.current = data.liveChatId ?? liveChatIdRef.current;
      pageTokenRef.current = data.nextPageToken ?? pageTokenRef.current;
      liveTitleRef.current = data.liveTitle ?? liveTitleRef.current;

      setLiveTitle(liveTitleRef.current);

      const fetchedChats: ChatLogItem[] = data.chats ?? [];
      const existingIds = knownChatIdsRef.current;
      const freshChats = fetchedChats.filter(chat => !existingIds.has(chat.messageId));
      const arrivedIds = freshChats.map(chat => chat.messageId);

      freshChats.forEach(chat => knownChatIdsRef.current.add(chat.messageId));
      initializedChatsRef.current = true;
      if (freshChats.length > 0) {
        setChats(prev => [...prev, ...freshChats]);
      }

      if (arrivedIds.length > 0) {
        setNewChatIds(prev => {
          const next = new Set(prev);
          arrivedIds.forEach(id => next.add(id));
          return next;
        });

        window.setTimeout(() => {
          setNewChatIds(prev => {
            const next = new Set(prev);
            arrivedIds.forEach(id => next.delete(id));
            return next;
          });
        }, 4500);
      }

      setStatus(
        `수집 중 · 이번 호출 ${data.totalMessages ?? 0}개 · 새 채팅 ${arrivedIds.length}개`,
      );

      scheduleNext(
        Math.max(Number(data.pollingIntervalMillis ?? MIN_POLL_MS), MIN_POLL_MS),
      );
    } catch {
      setStatus("네트워크 오류 · 30초 뒤 자동 재시도");
      scheduleNext(ERROR_RETRY_MS);
    }
  }

  function startYoutube() {
    if (!youtubeUrl.trim()) {
      setStatus("YouTube 라이브 링크를 입력하세요.");
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    liveChatIdRef.current = "";
    pageTokenRef.current = "";
    liveTitleRef.current = "";

    runningRef.current = true;
    setRunning(true);
    setLiveTitle("");
    setStatus("라이브 방송과 채팅을 찾는 중...");
    pollYoutube();
  }

  function stopYoutube() {
    runningRef.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    setRunning(false);
    setStatus("채팅 수집이 중지되었습니다.");
  }

  function clearAllChats() {
    if (!window.confirm("현재 브라우저의 채팅을 모두 삭제할까요?")) return;
    setChats([]);
    knownChatIdsRef.current = new Set();
    initializedChatsRef.current = true;
    setNewChatIds(new Set());
    setSearch("");
    setStatus("채팅을 비웠습니다.");
  }

  function searchThisUser(chat: ChatLogItem) {
    setSearch(chat.authorName || chat.authorHandle || chat.authorChannelId || "");
  }

  useEffect(() => {
    initializedChatsRef.current = true;
    return () => {
      runningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <main className="page">
      <header className="top">
        <div>
          <h1>YouTube Live Chat Viewer</h1>
          <p>라이브 채팅 전체 보기 · 닉네임별 채팅 모아보기</p>
        </div>

        <div className={`state ${running ? "on" : ""}`}>
          <span />
          {running ? "LIVE 수집 중" : "대기"}
        </div>
      </header>

      <section className="connect">
        <div className="urlArea">
          <label htmlFor="youtube-url">YouTube 라이브 링크</label>
          <div className="urlRow">
            <input
              id="youtube-url"
              value={youtubeUrl}
              onChange={event => setYoutubeUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !running) startYoutube();
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={running}
            />

            {!running ? (
              <button className="start" onClick={startYoutube}>
                채팅 불러오기
              </button>
            ) : (
              <button className="stop" onClick={stopYoutube}>
                수집 중지
              </button>
            )}
          </div>
        </div>

        <div className="connectBottom">
          <div>
            <strong>{liveTitle || "방송 미연결"}</strong>
            <span>{status}</span>
          </div>

          <button className="clear" onClick={clearAllChats}>
            채팅 비우기
          </button>
        </div>
      </section>

      <section className="columns">
        <section className="panel allPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">ALL CHAT</span>
              <h2>전체 채팅</h2>
            </div>
            <strong className="count">{chats.length}</strong>
          </div>

          <div className="chatList">
            {reversedChats.length === 0 ? (
              <Empty text="아직 불러온 채팅이 없습니다." />
            ) : (
              reversedChats.map(chat => (
                <ChatRow
                  key={chat.messageId}
                  chat={chat}
                  isNew={newChatIds.has(chat.messageId)}
                  onUserClick={searchThisUser}
                />
              ))
            )}
          </div>
        </section>

        <aside className="panel searchPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">USER SEARCH</span>
              <h2>사용자 채팅 검색</h2>
            </div>
            <strong className="count accent">
              {search.trim() ? searchedChats.length : 0}
            </strong>
          </div>

          <div className="searchBox">
            <label htmlFor="nickname">닉네임 / @아이디</label>
            <div className="searchInputRow">
              <input
                id="nickname"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="예: 홍길동"
              />
              <button
                onClick={() => setSearch("")}
                disabled={!search.trim()}
              >
                초기화
              </button>
            </div>

            <p>
              왼쪽 채팅에서 닉네임을 클릭해도 바로 검색됩니다.
            </p>
          </div>

          {search.trim() && (
            <div className="searchSummary">
              <strong>{matchedUser}</strong>
              <span>총 {searchedChats.length}개 채팅</span>
            </div>
          )}

          <div className="chatList searchList">
            {!search.trim() ? (
              <Empty text="검색할 닉네임이나 아이디를 입력하세요." />
            ) : searchedChats.length === 0 ? (
              <Empty text="일치하는 사용자의 채팅이 없습니다." />
            ) : (
              searchedChats.map(chat => (
                <ChatRow
                  key={`search-${chat.messageId}`}
                  chat={chat}
                  compact
                  isNew={newChatIds.has(chat.messageId)}
                  onUserClick={searchThisUser}
                />
              ))
            )}
          </div>
        </aside>
      </section>

      <style jsx>{`
        .page {
          width: min(980px, 100%);
          margin: 0 auto;
          padding: 16px;
        }

        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: clamp(27px, 3vw, 42px);
          letter-spacing: -0.04em;
        }

        .top p {
          margin: 7px 0 0;
          color: #a7b0c0;
          font-size: 15px;
        }

        .state {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          border: 1px solid #334155;
          border-radius: 999px;
          padding: 9px 13px;
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 800;
          background: #111827;
        }

        .state span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #64748b;
        }

        .state.on {
          color: #fecaca;
          border-color: #7f1d1d;
          background: #2a1014;
        }

        .state.on span {
          background: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.16);
        }

        .connect {
          border: 1px solid #293548;
          border-radius: 18px;
          background: #0d1421;
          padding: 14px;
          margin-bottom: 12px;
        }

        .urlArea label,
        .searchBox label {
          display: block;
          margin-bottom: 8px;
          color: #e5e7eb;
          font-size: 13px;
          font-weight: 800;
        }

        .urlRow,
        .searchInputRow {
          display: flex;
          gap: 10px;
        }

        input {
          min-width: 0;
          flex: 1;
          border: 1px solid #3b485e;
          border-radius: 12px;
          background: #050912;
          color: #ffffff;
          padding: 13px 14px;
          outline: none;
        }

        input::placeholder {
          color: #667085;
        }

        input:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
        }

        button {
          border: 0;
          border-radius: 12px;
          padding: 11px 15px;
          background: #263247;
          color: #ffffff;
          font-weight: 800;
        }

        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .start {
          background: #2563eb;
        }

        .stop {
          background: #dc2626;
        }

        .clear {
          background: #30171b;
          color: #fecaca;
          border: 1px solid #6f2630;
        }

        .connectBottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-top: 14px;
        }

        .connectBottom div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .connectBottom strong {
          overflow: hidden;
          color: #f8fafc;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .connectBottom span {
          color: #facc15;
          font-size: 13px;
        }

        .columns {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.9fr);
          gap: 12px;
          align-items: start;
        }

        .panel {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #293548;
          border-radius: 18px;
          background: #0d1421;
        }

        .searchPanel {
          border-color: #254d72;
        }

        .panelHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px;
          border-bottom: 1px solid #243044;
        }

        .eyebrow {
          display: block;
          margin-bottom: 4px;
          color: #7f8da3;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.03em;
        }

        .count {
          display: grid;
          place-items: center;
          min-width: 44px;
          height: 36px;
          border-radius: 999px;
          background: #1e293b;
          color: #ffffff;
          padding: 0 12px;
          font-size: 14px;
        }

        .count.accent {
          background: #133454;
          color: #bae6fd;
        }

        .searchBox {
          padding: 12px 14px;
          border-bottom: 1px solid #243044;
          background: #0a111d;
        }

        .searchBox p {
          margin: 9px 0 0;
          color: #8391a7;
          font-size: 12px;
        }

        .searchSummary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 1px solid #243044;
          background: #102033;
        }

        .searchSummary strong {
          overflow: hidden;
          color: #ffffff;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .searchSummary span {
          flex: 0 0 auto;
          color: #bae6fd;
          font-size: 13px;
          font-weight: 800;
        }

        .chatList {
          height: 68vh;
          min-height: 500px;
          overflow-y: auto;
          padding: 7px;
        }

        .searchList {
          height: calc(68vh - 145px);
          min-height: 355px;
        }

        @media (max-width: 720px) {
          .columns {
            grid-template-columns: 1fr;
          }

          .chatList,
          .searchList {
            height: auto;
            min-height: 320px;
            max-height: 65vh;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 12px;
          }

          .top,
          .connectBottom {
            align-items: stretch;
            flex-direction: column;
          }

          .state {
            width: fit-content;
          }

          .urlRow,
          .searchInputRow {
            flex-direction: column;
          }

          .clear {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function ChatRow({
  chat,
  compact = false,
  isNew = false,
  onUserClick,
}: {
  chat: ChatLogItem;
  compact?: boolean;
  isNew?: boolean;
  onUserClick: (chat: ChatLogItem) => void;
}) {
  const name = chat.authorName || chat.authorHandle || "Unknown";

  return (
    <article className={`chatRow ${compact ? "compact" : ""} ${isNew ? "newChat" : ""} ${chat.isMember ? "member" : ""}`}>
      <div className="chatMeta">
        <button
          className={`author ${chat.isModerator ? "moderatorAuthor" : chat.isMember ? "memberAuthor" : "normalAuthor"}`}
          onClick={() => onUserClick(chat)}
          title={`${name} 채팅만 보기`}
        >
          {name}
        </button>
        <time>{formatTime(chat.publishedAt || chat.receivedAt)}</time>
      </div>

      <p>{chat.text}</p>

      <style jsx>{`
        .chatRow {
          border-bottom: 1px solid #1e293b;
          padding: 11px 9px 12px;
        }

        .chatRow:last-child {
          border-bottom: 0;
        }

        .chatRow.newChat {
          border-radius: 10px;
          animation: newChatFade 4.5s ease-out forwards;
        }

        @keyframes newChatFade {
          0% {
            background: rgba(34, 197, 94, 0.42);
          }
          18% {
            background: rgba(34, 197, 94, 0.32);
          }
          55% {
            background: rgba(34, 197, 94, 0.14);
          }
          100% {
            background: transparent;
          }
        }

        .chatRow:hover {
          border-radius: 10px;
          background: #111a29;
        }

        .chatMeta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 7px;
        }

        .author {
          min-width: 0;
          overflow: hidden;
          border: 0;
          background: transparent;
          color: #ffffff;
          padding: 0;
          text-align: left;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .author:hover {
          color: #ffffff;
          text-decoration: underline;
        }

        .author.normalAuthor {
          color: #ffffff;
        }

        .author.memberAuthor {
          color: #4ade80;
          font-weight: 950;
        }

        .author.memberAuthor:hover {
          color: #86efac;
        }

        .author.moderatorAuthor {
          color: #60a5fa;
          font-weight: 950;
        }

        .author.moderatorAuthor:hover {
          color: #93c5fd;
        }

        time {
          flex: 0 0 auto;
          color: #6f7d91;
          font-size: 12px;
        }

        p {
          margin: 0;
          color: #ffffff;
          font-size: ${compact ? "15px" : "16px"};
          font-weight: 650;
          line-height: 1.55;
          word-break: break-word;
        }

        .compact {
          padding-top: 10px;
          padding-bottom: 10px;
        }
      `}</style>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span>◌</span>
      <p>{text}</p>

      <style jsx>{`
        .empty {
          display: grid;
          place-items: center;
          align-content: center;
          min-height: 260px;
          color: #77859b;
          text-align: center;
        }

        span {
          margin-bottom: 8px;
          color: #536176;
          font-size: 34px;
        }

        p {
          margin: 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
