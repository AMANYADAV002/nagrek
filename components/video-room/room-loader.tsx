"use client";

import dynamic from "next/dynamic";
import { FullScreenLoader } from "@/components/glass/states";
import type { MockUser } from "@/lib/types";

/** Keeps the room (camera, music engine, WebRTC) out of every other route's bundle. */
const VideoRoom = dynamic(() => import("./video-room").then((m) => m.VideoRoom), {
  ssr: false,
  loading: () => <FullScreenLoader label="Setting up your table…" />,
});

export function RoomLoader(props: { meetingId: string; partner: MockUser; food: string; live?: { me: string; role: "a" | "b" } }) {
  return <VideoRoom {...props} />;
}
