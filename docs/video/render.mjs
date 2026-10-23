// Renders sumbong-flow.html frame by frame into sumbong-flow.mp4.
//   node docs/video/render.mjs                 full render (needs ffmpeg and playwright-core resolvable from the cwd)
// It uses Google Chrome at the macOS path below when present; elsewhere it needs a
// Playwright-managed Chromium (`npx playwright-core install chromium`).
//   node docs/video/render.mjs --stills 5,30   PNG stills at those seconds, for checking
//   node docs/video/render.mjs --cues-only     write cues.json (sound cue list) and stop
// If sumbong-flow-audio.wav exists (node docs/video/sound.mjs), it is muxed into the MP4.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(path.join(process.cwd(), "noop.js"));
const { chromium } = require("playwright-core");

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const stillsArg = args.includes("--stills") ? args[args.indexOf("--stills") + 1] : null;
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : here;
const FPS = 30;

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, "sumbong-flow.html")).href + "?render");
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all(['400 20px "IBM Plex Sans"', '600 20px "IBM Plex Sans"', '700 20px "IBM Plex Sans"', '600 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f))));
const stage = page.locator("#stage");
const DUR = await page.evaluate(() => window.__DUR);
await page.evaluate(() => window.__calib());
writeFileSync(path.join(here, "cues.json"), JSON.stringify(await page.evaluate(() => window.__cues()), null, 0));
if (args.includes("--cues-only")) { await browser.close(); process.exit(0); }

if (stillsArg) {
  mkdirSync(outDir, { recursive: true });
  for (const s of stillsArg.split(",").map(Number)) {
    await page.evaluate((t) => window.__render(t), s);
    await stage.screenshot({ path: path.join(outDir, `still-${String(s).padStart(5, "0")}.png`) });
  }
  await browser.close();
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "sumbong-flow.silent.mp4");
const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
// An encoder that exits early must stop the render, not leave it waiting for "drain".
const encoded = new Promise((resolve, reject) => {
  ff.on("error", reject);
  ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
});
encoded.catch(() => {}); // observed below; avoids an unhandled rejection mid-loop
let stdinError = null;
ff.stdin.on("error", (error) => (stdinError = error));
const frames = Math.round(DUR * FPS);
try {
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.__render(t), f / FPS);
    const buf = await stage.screenshot({ type: "jpeg", quality: 95 });
    if (stdinError) throw stdinError;
    if (!ff.stdin.write(buf)) await Promise.race([new Promise((r) => ff.stdin.once("drain", r)), encoded]);
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await encoded;
} catch (error) {
  ff.kill();
  await browser.close();
  if (existsSync(out)) unlinkSync(out);
  throw error;
}
await browser.close();
const audio = path.join(here, "sumbong-flow-audio.wav"), final = path.join(outDir, "sumbong-flow.mp4");
if (existsSync(audio)) {
  await new Promise((r, j) => spawn("ffmpeg", ["-y", "-i", out, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], { stdio: "inherit" })
    .on("close", (c) => (c ? j(new Error("mux failed")) : r())));
  unlinkSync(out);
} else renameSync(out, final);
console.log("wrote", final);
