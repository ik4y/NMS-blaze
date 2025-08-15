import { config } from "dotenv";
import path from "node:path";
export const MEDIAROOT = path.resolve(__dirname, "../../media");
config();

export const NmsConfig = {
  logType: 3,
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8888,
    mediaroot: MEDIAROOT,
    allow_origin: "*",
    api: true
  },
  trans: {
    ffmpeg: "./ffmpeg",
    tasks: [
      {
        app: "live",
        hls: true,
        hlsFlags: "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
        hlsKeep: false
      }
    ],
    MediaRoot: "./media"
  }
};
