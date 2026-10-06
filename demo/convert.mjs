// Convert Playwright .webm recordings into web-ready .mp4 (H.264) + poster PNG,
// burning recorded captions into a reserved band (desktop) / the phone backdrop (mobile).
//
// Usage: node convert.mjs
// Env:   FFMPEG         path to ffmpeg binary (optional)
//        DEMO_OUT_DIR   output dir (optional; defaults to the portfolio assets/demo)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAss } from "./ass.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(here, "test-results", "demo");

// The published clips live in the portfolio repo (single source of truth).
// `DEMO_OUT_DIR` overrides; otherwise write straight into the sibling portfolio.
const portfolioOutDir = path.resolve(here, "..", "..", "danigrande.github.io", "assets", "demo");
const outDir = process.env.DEMO_OUT_DIR
  ? path.resolve(process.env.DEMO_OUT_DIR)
  : fs.existsSync(path.dirname(portfolioOutDir))
    ? portfolioOutDir
    : path.join(here, "demo-videos");
if (outDir !== portfolioOutDir && !process.env.DEMO_OUT_DIR) {
  console.warn(
    `[convert] Portfolio not found — writing to ${outDir}. Set DEMO_OUT_DIR to override.`,
  );
}

const NAMES = [
  { match: "web", out: "worldcup-web", posterAt: "24", layout: "desktop" },
  { match: "mobile", out: "worldcup-mobile", posterAt: "20", layout: "mobile" },
  { match: "agent", out: "worldcup-agent-prd", posterAt: "18", layout: "desktop", speed: 1.3 },
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

  // Read captions first: `readyOffset` marks how many leading ms to trim so the
  // clip opens on real content (skips page load / white flash).
  const captionsFile = path.join(videoDir, "captions.json");
  const captionsData = fs.existsSync(captionsFile)
    ? JSON.parse(fs.readFileSync(captionsFile, "utf8"))
    : null;
  const readyOffset = Math.max(0, captionsData?.readyOffset ?? 0);
  const trimStart = readyOffset / 1000;

  // 1. Encode the raw recording to a finite mp4 (trimming the leading frames).
  const encodeArgs = ["-y"];
  if (trimStart > 0.05) encodeArgs.push("-ss", trimStart.toFixed(3));
  encodeArgs.push(
    "-i", video, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4,
  );
  const encode = spawnSync(ffmpeg, encodeArgs, { stdio: "inherit" });
  if (encode.status !== 0) throw new Error(`ffmpeg encode failed for ${video}`);

  // 2. Burn captions into a reserved band if a captions track exists.
  if (captionsData) {
    const { t0, tEnd, captions } = captionsData;
    const speed = key.speed && key.speed > 1 ? key.speed : 1;
    const layout = LAYOUTS[key.layout] ?? LAYOUTS.desktop;
    const trimmedDuration = probeDuration(ffprobe, mp4); // seconds, before cuts

    // Dead-time ranges (ms, relative to t0) to cut out of the clip.
    const cutRanges = (Array.isArray(captionsData.cuts) ? captionsData.cuts : [])
      .map((c) => ({
        start: (c.start - readyOffset) / 1000,
        end: (c.end - readyOffset) / 1000,
      }))
      .filter((c) => c.end > 0 && c.end > c.start)
      .map((c) => ({ start: Math.max(0, c.start), end: Math.min(trimmedDuration, c.end) }))
      .filter((c) => c.end > c.start)
      .sort((a, b) => a.start - b.start);

    const totalCut = cutRanges.reduce((acc, c) => acc + (c.end - c.start), 0);
    const duration = (trimmedDuration - totalCut) / speed;

    // Remap caption times into the final timeline (cuts removed, then speed applied).
    const cutBefore = (tSec) =>
      cutRanges.reduce((acc, c) => acc + Math.max(0, Math.min(c.end, tSec) - c.start), 0);
    const remapped = captions.map((c) => {
      const tSec = (c.t - t0 - readyOffset) / 1000;
      const finalSec = (tSec - cutBefore(tSec)) / speed;
      return { t: Math.max(0, finalSec) * 1000, text: c.text };
    });
    const ass = buildAss({ captions: remapped, t0: 0, tEnd: duration * 1000, duration, ...layout });
    const assPath = path.join(videoDir, "captions.ass");
    fs.writeFileSync(assPath, ass);

    const framed = `${mp4}.tmp.mp4`;
    const isMobile = key.layout === "mobile" && fs.existsSync(FRAME_PATH);

    // Drop the cut ranges and renumber the timeline, then optionally speed up.
    const cutExpr = cutRanges
      .map((c) => `between(t\\,${c.start.toFixed(3)}\\,${c.end.toFixed(3)})`)
      .join("+");
    const cutFilter = cutRanges.length
      ? `select='not(${cutExpr})',setpts=N/FRAME_RATE/TB,`
      : "";
    const speedFilter = speed > 1 ? `setpts=PTS/${speed},` : "";
    const pre = `${cutFilter}${speedFilter}`;
    console.log(
      `  burning ${captions.length} captions (${key.layout}${speed > 1 ? `, ${speed}x` : ""}${cutRanges.length ? `, ${cutRanges.length} cuts` : ""})`,
    );

    const args = isMobile
      ? [
          "-y",
          "-i", mp4,
          "-i", FRAME_PATH,
          "-filter_complex",
          `[0:v]${pre}scale=390:844[vid];` +
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
          `${pre}pad=${layout.width}:${layout.height}:0:0:color=0x0b1220,` +
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
