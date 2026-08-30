import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import FrameVideoEncoder from '../../modules/frame-video-encoder';
import {
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  advancePts,
  buildCapturePlan,
  captureProgress,
  holdKeyframePts,
  retimedPts,
} from '../lib/replayExport';
import type { Beat } from '../lib/handReplay';
import { nextFrame } from '../lib/nextFrame';

// Recording the replay as a story-ready MP4. This is the single biggest thing the replayer
// screen used to do, and none of it is about rendering a poker table: an encoder session, a
// capture loop with its own backpressure, PTS bookkeeping, an abort token, a progress model
// and a deep-link protocol. Lifted out whole so the screen is left with the felt.
//
// The arithmetic it runs on (windows, holds, PTS, progress weighting) lives in
// src/lib/replayExport.ts and is unit-tested; what stays here is the I/O that cannot be.


export interface VideoExport {
  state: 'idle' | 'exporting';
  percent: number;
  message: { type: 'error' | 'success'; text: string } | null;
  /** The finished file, kept so the share sheet can be reopened without re-exporting. */
  videoUri: string | null;
  run: () => void;
  /** Bump the abort token — the header X, and unmount. */
  cancel: () => void;
  openShareSheet: (uri: string) => void;
}

interface Options {
  beats: Beat[];
  /** Ref on the view the capture photographs. Owned by the screen that renders it — the
   *  hook only reads it, and returning it here would make every render-time read of this
   *  object look like a ref access. */
  shotRef: React.RefObject<View | null>;
  /** The export loop drives the beat cursor the screen owns. */
  seek: (index: number) => void;
  stopPlayback: () => void;
  /** The `export=1` deep link, consumed once per navigation. */
  exportParam?: string;
  /** Clear the param once consumed — without this the reset effect below never fires and a
   *  SECOND deep-linked export silently does nothing. */
  onExportParamConsumed?: () => void;
}

export function useVideoExport({
  beats,
  shotRef,
  seek,
  stopPlayback,
  exportParam,
  onExportParamConsumed,
}: Options): VideoExport {
  const { t } = useTranslation('replayer');
  const [exportState, setExportState] = useState<'idle' | 'exporting'>('idle');
  const [exportPercent, setExportPercent] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  // Monotonic run id — bumping it aborts any in-flight export loop (cancel via X, unmount).
  const exportRunRef = useRef(0);
  const consumedExportRef = useRef(false);
  const runExportRef = useRef<() => void>(() => {});
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = (type: 'error' | 'success', text: string) => {
    setExportMessage({ type, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setExportMessage(null), 2500);
  };

  const openShareSheet = async (uri: string) => {
    try {
      if (!(await Sharing.isAvailableAsync())) return;
      await Sharing.shareAsync(uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
    } catch {
      // Dismissing the sheet rejects on some platforms; nothing has gone wrong.
    }
  };

  const runExport = async () => {
    if (exportState !== 'idle' || beats.length === 0) return;
    const run = ++exportRunRef.current;
    const cancelled = () => exportRunRef.current !== run;
    setExportState('exporting');
    stopPlayback();
    seek(0);
    // Encoder calls are fired without awaiting — the native side serializes them — so the
    // capture loop keeps its cadence; the first error is kept and re-thrown after the walk.
    let encodeError: unknown = null;
    let chain: Promise<void> = Promise.resolve();
    // …but "without awaiting" has to stop somewhere: every unawaited append holds a
    // full-resolution JPEG in the cache and a decode buffer in flight, and a long hand puts
    // hundreds through. Beyond this many outstanding frames the loop waits for the encoder
    // to catch up before capturing another.
    const MAX_FRAMES_IN_FLIGHT = 8;
    let inFlight = 0;
    let framesAppended = 0;
    const appendFrame = (uri: string, ptsMs: number) => {
      inFlight++;
      chain = chain
        .then(() => FrameVideoEncoder.appendFrame(uri, ptsMs))
        .then(() => {
          framesAppended++;
        })
        .catch((e: unknown) => {
          encodeError = encodeError ?? e;
        })
        // Release only once the encoder is done with the file: dropping it from under a
        // decode still in progress is a prime suspect for the mid-export white screen.
        .finally(() => {
          inFlight--;
          releaseCapture(uri);
        });
    };
    const drainTo = async (limit: number) => {
      while (inFlight > limit && !encodeError && !cancelled()) await chain;
    };
    const repeatFrame = (ptsMs: number) => {
      chain = chain
        .then(() => FrameVideoEncoder.repeatLastFrame(ptsMs))
        .catch((e: unknown) => {
          encodeError = encodeError ?? e;
        });
    };
    // Progress is weighted by how long each beat actually takes to capture (its animation
    // window, stretched by the slow-motion factor) rather than by beat count — beats differ
    // by an order of magnitude, so a step counter jumps unevenly. The last slice is
    // reserved for muxing and saving, which happen after the walk.
    const plan = buildCapturePlan(beats);
    const totalWork = plan.reduce((sum, b) => sum + b.work, 0) || 1;
    let workDone = 0;
    let lastShown = -1;
    const reportProgress = (fraction: number) => {
      const pct = Math.round(fraction * 100);
      if (pct !== lastShown) {
        lastShown = pct;
        setExportPercent(fraction);
      }
    };

    try {
      await FrameVideoEncoder.createSession({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
      let basePts = 0; // video-time cursor, ms
      for (let i = 0; i < beats.length; i++) {
        if (cancelled()) throw new Error('cancelled');
        seek(i);
        await nextFrame();
        const capture = () => captureRef(shotRef, { format: 'jpg', quality: 0.9 });
        // Animated window: capture as fast as view-shot allows, stamping each frame with
        // its retimed PTS. Wall clock runs at EXPORT_SLOWMO×, the video at 1×.
        const { windowMs, holdMs, captureMs } = plan[i];
        const start = Date.now();
        while (Date.now() - start < captureMs) {
          await drainTo(MAX_FRAMES_IN_FLIGHT);
          if (cancelled()) throw new Error('cancelled');
          if (encodeError) throw encodeError;
          const tCapture = Date.now() - start;
          const uri = await capture();
          if (!uri) throw new Error('capture failed');
          appendFrame(uri, retimedPts(basePts, tCapture));
          reportProgress(captureProgress(workDone + tCapture, totalWork));
        }
        // Settled frame at the window boundary, then the beat's dwell — pure PTS
        // bookkeeping, no wall time spent.
        const settledUri = await capture();
        if (!settledUri) throw new Error('capture failed');
        appendFrame(settledUri, basePts + windowMs);
        for (const pts of holdKeyframePts(basePts, windowMs, holdMs)) repeatFrame(pts);
        basePts = advancePts(basePts, windowMs, holdMs);
        workDone += plan[i].work;
        reportProgress(captureProgress(workDone, totalWork));
      }
      reportProgress(0.95); // frames are in; the encoder still has to mux and write
      await chain;
      if (encodeError) throw encodeError;
      if (cancelled()) throw new Error('cancelled');
      // Muxing a session that never took a frame produces a file no player will open.
      if (framesAppended === 0) throw new Error('no frames captured');
      const outputUri = await FrameVideoEncoder.finish(basePts);
      if (cancelled()) throw new Error('cancelled');
      reportProgress(1);
      setVideoUri(outputUri);
      showMessage('success', t('export.videoReady'));
      setExportState('idle');
      // Straight into the share sheet — publishing the story is the point of the export, and
      // the sheet's own "Save to Photos" is the save. Outside the try: dismissing the sheet
      // rejects, and that is not a failed export.
      void openShareSheet(outputUri);
    } catch (e) {
      console.warn('[replayer] video export failed', {
        framesAppended,
        inFlight,
        beats: beats.length,
        error: e,
      });
      await FrameVideoEncoder.abort().catch(() => {});
      if (!cancelled()) showMessage('error', t('export.saveFailed'));
    } finally {
      if (!cancelled()) {
        setExportState('idle');
      }
    }
  };
  // Latest-ref pattern: the export-param effect below calls through this ref so it can
  // depend only on the param, not on every piece of state runExport closes over.
  useEffect(() => {
    runExportRef.current = runExport;
  });

  useEffect(() => {
    // Arriving with ?export=1 (from the recap screen's "export" button) starts the run
    // once; the ref guard survives the re-render the param clear causes.
    if (exportParam === '1' && !consumedExportRef.current && beats.length > 0) {
      consumedExportRef.current = true;
      onExportParamConsumed?.();
      runExportRef.current();
    }
  }, [exportParam, beats.length, onExportParamConsumed]);

  useEffect(() => {
    if (exportParam !== '1') consumedExportRef.current = false;
  }, [exportParam]);

  useEffect(
    () => () => {
      exportRunRef.current++; // abort any in-flight export on unmount (Android back included)
      FrameVideoEncoder.abort().catch(() => {});
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    []
  );

  return {
    state: exportState,
    percent: exportPercent,
    message: exportMessage,
    videoUri,
    run: () => void runExport(),
    cancel: () => {
      exportRunRef.current++;
      FrameVideoEncoder.abort().catch(() => {});
    },
    openShareSheet: (uri: string) => void openShareSheet(uri),
  };
}
