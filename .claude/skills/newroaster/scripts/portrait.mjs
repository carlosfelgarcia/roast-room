#!/usr/bin/env node
// Make a new seat's cartoon portrait the same way the original seven were made: a real photo
// of the person plus a style reference (one of the existing cartoons) go to Seedream 5 Pro
// image-to-image, which returns a 3D animated-film bust on a green screen. Then three edits of
// the chosen bust give the talking frames (mouth open, mouth "oh", eyes closed).
// build_portraits.py turns those into the room's aligned, keyed frames.
//
// The image jobs run through the Magnific MCP (images_generate, mode seedream-5-pro), which only
// Claude can call. This script does the local parts around those calls:
//
//   node .claude/skills/newroaster/scripts/portrait.mjs photo  <dir> <image url or file>
//   node .claude/skills/newroaster/scripts/portrait.mjs put    <file> <proxyUploadUrl>
//   node .claude/skills/newroaster/scripts/portrait.mjs prompt base "<who and what they wear>"
//   node .claude/skills/newroaster/scripts/portrait.mjs prompt open|mid|blink
//   node .claude/skills/newroaster/scripts/portrait.mjs save   <dir> <name> <result url>
//   node .claude/skills/newroaster/scripts/portrait.mjs pick   <dir> <candidate number>
//
// <dir> is the seat's portrait folder, <build>/portrait/. It holds photo.jpg, cand1.png...,
// base.png, open.png, mid.png, and blink.png.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STYLE_REF = path.join(HERE, "..", "assets", "style-reference.jpg");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// The exact prompts the original seven were built with. Change them and new seats stop matching.
const STYLE = "Turn the real person in the first image into a stylized 3D animated-film cartoon caricature drawn in exactly the same art style, rendering, lighting, and framing as the cartoon in the second image: head and upper chest bust, facing the camera straight on, centered, eyes looking at the viewer, mouth closed in a relaxed friendly smile. Keep the real person's likeness from the first image exactly: face shape, nose, eyes, eyebrows, hairline, and facial hair. Plain flat solid pure green (#00ff00) background, nothing else in the frame, no text except on the clothing.";
const KEEP = "Keep everything else exactly identical: same character, same face, same head position and size, same pose, same clothes, same lighting, same framing, same green background.";
const EDITS = {
  open: `Edit this image: the character is mid-sentence talking, mouth open wide in an 'ah' shape, teeth and tongue visible. ${KEEP} Only the mouth changes.`,
  mid: `Edit this image: the character is talking, mouth half open saying 'oh', lips slightly rounded. ${KEEP} Only the mouth changes.`,
  blink: `Edit this image: the character blinks, both eyes fully closed with relaxed eyelids. ${KEEP} Only the eyes change.`,
};

const [cmd, a1, a2, a3] = process.argv.slice(2);
const need = (f) => { if (!fs.existsSync(f)) { console.error(`portrait: missing ${f}`); process.exit(2); } return f; };
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

if (cmd === "photo") {
  if (!a2) throw new Error("usage: portrait.mjs photo <dir> <image url or file>");
  const dir = path.resolve(a1);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, "photo.jpg");
  if (/^https?:/i.test(a2)) {
    const r = await fetch(a2, { headers: { "user-agent": UA } });
    if (!r.ok) throw new Error(`download ${r.status}`);
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  } else fs.copyFileSync(a2, out);
  fs.writeFileSync(path.join(dir, "photo-source.txt"), a2 + "\n");
  console.log(`saved ${out}. Look at it before going on: one real person, face clear and toward the camera.`);
} else if (cmd === "put") {
  // "style" is a shortcut for the style reference, so the skill never has to spell out its path.
  const file = need(a1 === "style" ? STYLE_REF : path.resolve(a1));
  if (!a2) throw new Error("usage: portrait.mjs put <file|style> <proxyUploadUrl>");
  const r = await fetch(a2, { method: "PUT", headers: { "Content-Type": MIME[path.extname(file).toLowerCase()] || "image/jpeg" }, body: fs.readFileSync(file) });
  if (!r.ok) throw new Error(`upload ${r.status}: ${await r.text()}`);
  console.log(`uploaded ${path.basename(file)}`);
} else if (cmd === "prompt") {
  if (a1 === "base") {
    if (!a2) throw new Error('usage: portrait.mjs prompt base "<who and what they wear>"');
    console.log(`${STYLE} Person: ${a2}`);
  } else if (EDITS[a1]) console.log(EDITS[a1]);
  else throw new Error("usage: portrait.mjs prompt base \"<description>\" | prompt open|mid|blink");
} else if (cmd === "save") {
  if (!a3) throw new Error("usage: portrait.mjs save <dir> <name> <result url>");
  const r = await fetch(a3);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const out = path.join(path.resolve(a1), `${a2}.png`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log(`saved ${out}`);
} else if (cmd === "pick") {
  const dir = path.resolve(a1);
  fs.copyFileSync(need(path.join(dir, `cand${a2}.png`)), path.join(dir, "base.png"));
  console.log(`base.png = cand${a2}.png`);
} else {
  console.error("usage: portrait.mjs photo|put|prompt|save|pick ...");
  process.exit(1);
}
