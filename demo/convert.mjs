// Convert Playwright .webm recordings into web-ready .mp4 (H.264) + poster PNG,
// burning recorded captions into a reserved band (desktop) / the phone backdrop (mobile).
//
// Usage: node convert.mjs
// Env:   FFMPEG   path to ffmpeg binary (optional)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAss } from "./ass.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(here, "test-results", "demo");
const outDir = path.join(here, "demo-videos");

const NAMES = [
  { match: "web", out: "worldcup-web", posterAt: "18", layout: "desktop" },
  { match: "mobile", out: "worldcup-mobile", posterAt: "10", layout: "mobile" },
];

const FRAME_PATH = path.join(here, "assets", "phone-frame.png");
const LAYOUTS = {
  desktop: { width: 1920, height: 1200, fontSize: 36, marginV: 50, marginH: 140 },
  mobile: { width: 638, height: 1172, fontSize: 26, marginV: 112, marginH: 60 },
};

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG,
    "ffmpeg",
    path.join(
      process.env.LOCALAPPDATA || "",
      "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe",
    ),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (spawnSync(candidate, ["-version"], { stdio: "ignore" }).status === 0) return candidate;
  }
  throw new Error("ffmpeg not found. Install it or set the FFMPEG env var.");
}

function ffprobePathFor(ffmpeg) {
  return ffmpeg.replace(/ffmpeg(\.exe)?$/i, (m, ext) => `ffprobe${ext ?? ""}`);
}

function probeDuration(ffprobe, file) {
  const res = spawnSync(
    ffprobe,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  return Number.parseFloat(res.stdout?.trim() || "0") || 0;
}

function findVideos(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findVideos(full));
    else if (entry.name === "video.webm") found.push(full);
  }
  return found;
}

const ffmpeg = findFfmpeg();
const ffprobe = ffprobePathFor(ffmpeg);
fs.mkdirSync(outDir, { recursive: true });

const videos = findVideos(resultsDir);
if (videos.length === 0) {
  console.error(`No video.webm found under ${resultsDir}`);
  process.exit(1);
}

for (const video of videos) {
  const videoDir = path.dirname(video);
  const dirName = path.basename(videoDir).toLowerCase();
  const key = NAMES.find((n) => dirName.startsWith(n.match));
  if (!key) {
    console.warn(`Skipping unmatched recording: ${video}`);
    continue;
  }
  const mp4 = path.join(outDir, `${key.out}.mp4`);
  const poster = path.join(outDir, `${key.out}.png`);

  console.log(`Converting ${path.basename(videoDir)} -> ${key.out}.mp4`);

  // 1. Encode the raw recording to a finite mp4.
  const encode = spawnSync(
    ffmpeg,
    ["-y", "-i", video, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4],
    { stdio: "inherit" },
  );
  if (encode.status !== 0) throw new Error(`ffmpeg encode failed for ${video}`);

  // 2. Burn captions into a reserved band if a captions track exists.
  const captionsFile = path.join(videoDir, "captions.json");
  if (fs.existsSync(captionsFile)) {
    const { t0, tEnd, captions } = JSON.parse(fs.readFileSync(captionsFile, "utf8"));
    const duration = probeDuration(ffprobe, mp4);
    const layout = LAYOUTS[key.layout] ?? LAYOUTS.desktop;
    const ass = buildAss({ captions, t0, tEnd, duration, ...layout });
    const assPath = path.join(videoDir, "captions.ass");
    fs.writeFileSync(assPath, ass);

    const framed = `${mp4}.tmp.mp4`;
    const isMobile = key.layout === "mobile" && fs.existsSync(FRAME_PATH);
    console.log(`  burning ${captions.length} captions (${key.layout})`);

    const args = isMobile
      ? [
          "-y",
          "-i", mp4,
          "-i", FRAME_PATH,
          "-filter_complex",
          `[0:v]scale=390:844[vid];` +
            `color=c=0x0f172a:s=${layout.width}x${layout.height}[bg];` +
            `[bg][vid]overlay=124:84:shortest=1[t];` +
            `[t][1:v]overlay=110:70[t2];` +
            `[t2]ass=captions.ass,format=yuv420p[out]`,
          "-map", "[out]", "-an",
          "-c:v", "libx264", "-preset", "slow", "-crf", "20",
          "-movflags", "+faststart", framed,
        ]
      : [
          "-y",
          "-i", mp4,
          "-vf",
          `pad=${layout.width}:${layout.height}:0:0:color=0x0b1220,` +
            `drawbox=x=0:y=1078:w=${layout.width}:h=2:color=0xffffff@0.10:t=fill,` +
            `ass=captions.ass`,
          "-an",
          "-c:v", "libx264", "-preset", "slow", "-crf", "20",
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart", framed,
        ];

    const burn = spawnSync(ffmpeg, args, { stdio: "inherit", cwd: videoDir });
    if (burn.status !== 0) throw new Error(`ffmpeg caption burn failed for ${video}`);
    fs.renameSync(framed, mp4);
  }

  // 3. Poster.
  spawnSync(
    ffmpeg,
    ["-y", "-ss", key.posterAt ?? "1", "-i", mp4, "-frames:v", "1", "-update", "1", "-q:v", "2", poster],
    { stdio: "inherit" },
  );
}

console.log(`\nDone. Wrote ${videos.length} video(s) to ${outDir}`);
