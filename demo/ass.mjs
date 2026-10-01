// Build an .ass subtitle file from recorded caption timings.

function fmtTime(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function buildAss({
  captions,
  t0,
  tEnd,
  duration,
  width,
  height,
  fontSize,
  marginV,
  marginH = 90,
}) {
  const span = Math.max(1, tEnd - t0);
  const map = (t) => ((t - t0) / span) * duration;

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Demo,Segoe UI,${fontSize},&H00FFFFFF,&H000000FF,&H00101010,&H80000000,1,0,0,0,100,100,0,0,1,3,1,2,${marginH},${marginH},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events = [];
  for (let i = 0; i < captions.length; i += 1) {
    const start = map(captions[i].t);
    const end = i + 1 < captions.length ? map(captions[i + 1].t) : duration;
    if (end <= start + 0.05) continue;
    events.push(
      `Dialogue: 0,${fmtTime(start)},${fmtTime(end)},Demo,,0,0,0,,${captions[i].text}`,
    );
  }

  return `${header.concat(events).join("\n")}\n`;
}
