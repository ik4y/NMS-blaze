import axios from "axios";
import { config } from "dotenv";
import NodeMediaServer from "node-media-server";
import { MEDIAROOT, NmsConfig } from "./nms-config";
import path from "node:path";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
config({ path: "../.env.local" });

function startNmsServer() {
  // const BACKEND_BASE_URL = `http://localhost:5000`;
  // const nms = new NodeMediaServer(NmsConfig);

  // nms.on("postPublish", async (session: any) => {
  //   const streamKey = session.streamName;
  //   console.log("[postPublish]", {
  //     id: session?.id ?? session,
  //     path: session?.publishStreamPath ?? session?.streamPath // expect: /live/<streamKey>
  //   });
  //   try {
  //     await axios.post(`${BACKEND_BASE_URL}/streams/nms-on-publish`, {
  //       streamKey
  //     });
  //   } catch (err) {
  //     console.error(
  //       "Error notifying backend of publish event:",
  //       err?.message || err
  //     );
  //   }
  // });

  const BACKEND_BASE_URL = `http://localhost:5000`;
  const FFMPEG = "/usr/bin/ffmpeg";

  const nms = new NodeMediaServer(NmsConfig);

  // Keep a map of running ffmpeg processes keyed by streamKey/session id
  const procs = new Map<string, ChildProcessWithoutNullStreams>();

  nms.on("postPublish", async (sessionOrId: any, streamPathMaybe?: any) => {
    const sess = typeof sessionOrId === "object" ? sessionOrId : null;
    const streamPath: string =
      (typeof streamPathMaybe === "string" ? streamPathMaybe : undefined) ??
      sess?.publishStreamPath ??
      sess?.streamPath;

    const streamKey = streamPath?.split("/").pop();
    console.log("[postPublish]", { streamPath, streamKey });

    if (!streamKey) return;

    const outDir = path.join(MEDIAROOT, "live", streamKey);
    const outPl = path.join(outDir, "index.m3u8");

    const args = [
      "-y",
      "-i",
      `rtmp://127.0.0.1:1935${streamPath}`, // read from NMS
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-f",
      "hls",
      "-hls_time",
      "2",
      "-hls_list_size",
      "3",
      "-hls_flags",
      "delete_segments+independent_segments+program_date_time",
      outPl
    ];

    // ensure folder exists
    await import("node:fs/promises")
      .then((fs) => fs.mkdir(outDir, { recursive: true }))
      .catch(() => {});

    const p = spawn(FFMPEG, args, { stdio: "pipe" });
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
    procs.set(streamKey, p);

    // tell backend it's live
    try {
      await axios.post(`${BACKEND_BASE_URL}/streams/nms-on-publish`, {
        streamKey
      });
    } catch (e: any) {
      console.error("notify publish failed:", e?.message || e);
    }
  });

  nms.on("donePublish", async (session: any) => {
    const streamKey = session.streamName;
    try {
      await axios.post(`${BACKEND_BASE_URL}/streams/nms-on-done`, {
        streamKey
      });
    } catch (err) {
      console.error(
        "Error notifying backend of done event:",
        err?.message || err
      );
    }
  });

  nms.run();
  console.log("Node Media Server is running...");
}

startNmsServer();
