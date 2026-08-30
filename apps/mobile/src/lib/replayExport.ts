import { animWindowMsFor, holdMsFor, type Beat } from './handReplay';

// The arithmetic behind the story-video export: how long each beat is captured for, what
// timestamp every frame carries, and how far along the progress bar is.
//
// Pulled out of the capture loop in app/hand-replayer/play.tsx because these are the two
// things in the export that break silently. Get the PTS wrong and the file muxes fine but
// no player will scrub it; get the weighting wrong and the bar sits at 4% then jumps to
// done. Neither is visible until you watch a whole export, and neither was testable while
// it was interleaved with view-shot calls and encoder I/O.

/** Story format: 9:16 at 1080p, what Instagram/Snapchat expect. */
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

/**
 * The export runs every entering animation this many times slower while view-shot samples
 * the live view (~10 captures/s); retiming each frame's PTS by the same factor plays the
 * animations back at true speed — a ~10fps capture cadence becomes a ~30fps video.
 */
export const EXPORT_SLOWMO = 3;

/**
 * During a beat's static hold the last frame is just re-encoded at intervals (no capture,
 * no decode) — some players choke on multi-second gaps between frames.
 */
export const HOLD_KEEPALIVE_MS = 500;

/** The share of the progress bar spent capturing; the rest is muxing and saving. */
export const CAPTURE_SHARE = 0.92;

/** Rough per-beat capture cost, used to weight progress. Beats differ by an order of
 *  magnitude, so a step counter jumps unevenly. */
export function beatWorkWeights(beats: Beat[], slowmo = EXPORT_SLOWMO): number[] {
  return beats.map((b) => animWindowMsFor(b) * slowmo + 250);
}

/** How long to keep capturing a beat, in wall-clock ms. */
export function captureWindowMs(beat: Beat, slowmo = EXPORT_SLOWMO): number {
  return animWindowMsFor(beat) * slowmo;
}

/** A frame captured `tCaptureMs` into the (slowed) window, stamped in video time. */
export function retimedPts(basePts: number, tCaptureMs: number, slowmo = EXPORT_SLOWMO): number {
  return basePts + Math.round(tCaptureMs / slowmo);
}

/**
 * The keep-alive stamps filling a beat's static hold. Pure PTS bookkeeping — these repeat
 * the settled frame and cost no wall time.
 */
export function holdKeyframePts(
  basePts: number,
  windowMs: number,
  holdMs: number,
  keepaliveMs = HOLD_KEEPALIVE_MS
): number[] {
  const out: number[] = [];
  for (let t = keepaliveMs; t < holdMs; t += keepaliveMs) out.push(basePts + windowMs + t);
  return out;
}

/** Where the video-time cursor lands after a beat's window and its dwell. */
export function advancePts(basePts: number, windowMs: number, holdMs: number): number {
  return basePts + windowMs + holdMs;
}

export interface BeatCapturePlan {
  index: number;
  /** Wall-clock ms to keep capturing. */
  captureMs: number;
  /** Video-time ms the beat's animations occupy. */
  windowMs: number;
  /** Video-time ms the settled frame then dwells. */
  holdMs: number;
  work: number;
}

export function buildCapturePlan(beats: Beat[], slowmo = EXPORT_SLOWMO): BeatCapturePlan[] {
  const weights = beatWorkWeights(beats, slowmo);
  return beats.map((beat, index) => ({
    index,
    captureMs: captureWindowMs(beat, slowmo),
    windowMs: animWindowMsFor(beat),
    holdMs: holdMsFor(beat),
    work: weights[index],
  }));
}

/** Total video duration in ms — what `finish()` is handed as the final PTS. */
export function totalDurationMs(plan: BeatCapturePlan[]): number {
  return plan.reduce((pts, b) => advancePts(pts, b.windowMs, b.holdMs), 0);
}

/** Fraction of the bar filled after `workDone` of `totalWork`, capped at the capture share. */
export function captureProgress(workDone: number, totalWork: number, share = CAPTURE_SHARE): number {
  if (totalWork <= 0) return 0;
  return Math.min(workDone / totalWork, 1) * share;
}
