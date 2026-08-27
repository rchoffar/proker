import { requireNativeModule } from 'expo-modules-core';

export interface EncoderSessionOptions {
  /** Output video width in pixels. */
  width: number;
  /** Output video height in pixels. */
  height: number;
  /** H.264 average bit rate — defaults to 8 Mbps natively. */
  bitRate?: number;
}

/**
 * On-device MP4 encoder for frame sequences with explicit presentation timestamps
 * (variable frame rate). One session at a time; calls are serialized natively, so
 * appendFrame can be fired without awaiting each one — errors surface on the call's
 * promise and on finish().
 */
interface FrameVideoEncoderModule {
  /** Opens a new encoding session (implicitly aborting any previous one). */
  createSession(options: EncoderSessionOptions): Promise<void>;
  /**
   * Decodes the image at `uri` (file://), letterboxes it onto a black canvas of the
   * session's dimensions, and encodes it at `ptsMs`. Timestamps are forced monotonic.
   */
  appendFrame(uri: string, ptsMs: number): Promise<void>;
  /** Re-encodes the previously appended frame at `ptsMs` — cheap hold keep-alive. */
  repeatLastFrame(ptsMs: number): Promise<void>;
  /** Ends the video at `endMs` (the last frame holds until then) and returns the file:// mp4 path. */
  finish(endMs: number): Promise<string>;
  /** Tears the session down and deletes the partial output file. Safe to call when idle. */
  abort(): Promise<void>;
}

export default requireNativeModule<FrameVideoEncoderModule>('FrameVideoEncoder');
