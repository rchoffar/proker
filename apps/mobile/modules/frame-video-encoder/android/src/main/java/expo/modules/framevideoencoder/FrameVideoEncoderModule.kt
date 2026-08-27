package expo.modules.framevideoencoder

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.Handler
import android.os.HandlerThread
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.IOException

class SessionOptions : Record {
  @Field val width: Int = 1080
  @Field val height: Int = 1920
  @Field val bitRate: Int = 8_000_000
}

private class EncoderException(message: String, cause: Throwable? = null) :
  CodedException("E_VIDEO_ENCODER", message, cause)

// Encodes a sequence of frame images into an H.264 MP4 with explicit presentation
// timestamps (variable frame rate — the replay export captures frames at whatever cadence
// the JS side manages and retimes them here). MediaCodec input-surface + EGL is used
// because it is the only Android path with exact per-frame PTS control
// (eglPresentationTimeANDROID); all codec/GL work lives on the session's HandlerThread.
class FrameVideoEncoderModule : Module() {
  private var session: EncodingSession? = null

  override fun definition() = ModuleDefinition {
    Name("FrameVideoEncoder")

    AsyncFunction("createSession") { options: SessionOptions, promise: Promise ->
      session?.abortAsync()
      val cacheDir = appContext.cacheDirectory
      session = EncodingSession(cacheDir, options.width, options.height, options.bitRate).also {
        it.start(promise)
      }
    }

    AsyncFunction("appendFrame") { uri: String, ptsMs: Double, promise: Promise ->
      val current = session
        ?: return@AsyncFunction promise.reject(EncoderException("No encoding session — call createSession first"))
      current.appendFrame(uri, ptsMs.toLong(), promise)
    }

    AsyncFunction("repeatLastFrame") { ptsMs: Double, promise: Promise ->
      val current = session
        ?: return@AsyncFunction promise.reject(EncoderException("No encoding session — call createSession first"))
      current.repeatLastFrame(ptsMs.toLong(), promise)
    }

    AsyncFunction("finish") { endMs: Double, promise: Promise ->
      val current = session
        ?: return@AsyncFunction promise.reject(EncoderException("No encoding session — call createSession first"))
      session = null
      current.finish(endMs.toLong(), promise)
    }

    AsyncFunction("abort") { promise: Promise ->
      session?.abortAsync()
      session = null
      promise.resolve(null)
    }

    OnDestroy {
      session?.abortAsync()
      session = null
    }
  }
}

// One MP4 being written. Every member is confined to the HandlerThread below.
private class EncodingSession(
  cacheDir: File,
  private val width: Int,
  private val height: Int,
  private val bitRate: Int,
) {
  private val thread = HandlerThread("FrameVideoEncoder").apply { start() }
  private val handler = Handler(thread.looper)
  private val outputFile = File(cacheDir, "upk-replay-${System.currentTimeMillis()}.mp4")
  private val bufferInfo = MediaCodec.BufferInfo()

  private var codec: MediaCodec? = null
  private var muxer: MediaMuxer? = null
  private var gl: GlFrameWriter? = null
  private var trackIndex = -1
  private var muxerStarted = false
  // Kept decoded for repeatLastFrame — re-drawing it skips the whole decode.
  private var lastBitmap: Bitmap? = null
  // Timestamps are forced strictly monotonic; MediaMuxer rejects out-of-order samples.
  private var lastPtsUs = -1L

  fun start(promise: Promise) = handler.post {
    try {
      val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
        setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
        // Nominal only — surface-input frames carry their own timestamps.
        setInteger(MediaFormat.KEY_FRAME_RATE, 30)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
      }
      val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
      codec = encoder
      encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      val inputSurface = encoder.createInputSurface()
      encoder.start()
      gl = GlFrameWriter(inputSurface, width, height)
      muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      promise.resolve(null)
    } catch (t: Throwable) {
      releaseAll()
      promise.reject(EncoderException("createSession failed: ${t.message}", t))
    }
  }

  fun appendFrame(uri: String, ptsMs: Long, promise: Promise) = handler.post {
    try {
      val path = uri.removePrefix("file://")
      val bitmap = BitmapFactory.decodeFile(path) ?: throw IOException("Could not decode frame image at $uri")
      drawFrame(bitmap, ptsMs)
      lastBitmap?.takeIf { it !== bitmap }?.recycle()
      lastBitmap = bitmap
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject(EncoderException("appendFrame failed: ${t.message}", t))
    }
  }

  fun repeatLastFrame(ptsMs: Long, promise: Promise) = handler.post {
    try {
      val bitmap = lastBitmap ?: throw IllegalStateException("repeatLastFrame called before any appendFrame")
      drawFrame(bitmap, ptsMs)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject(EncoderException("repeatLastFrame failed: ${t.message}", t))
    }
  }

  fun finish(endMs: Long, promise: Promise) = handler.post {
    try {
      // One last repeat frame so the final image holds until the requested end time.
      lastBitmap?.let { drawFrame(it, endMs) }
      drainEncoder(endOfStream = true)
      val startedMuxer = muxer?.takeIf { muxerStarted }
      releaseCodecAndGl()
      startedMuxer?.stop()
      muxer?.release()
      muxer = null
      recycleBitmap()
      promise.resolve("file://${outputFile.absolutePath}")
    } catch (t: Throwable) {
      releaseAll()
      outputFile.delete()
      promise.reject(EncoderException("finish failed: ${t.message}", t))
    } finally {
      thread.quitSafely()
    }
  }

  fun abortAsync() = handler.post {
    releaseAll()
    outputFile.delete()
    thread.quitSafely()
  }

  private fun drawFrame(bitmap: Bitmap, ptsMs: Long) {
    val writer = gl ?: throw IllegalStateException("session not started")
    val ptsUs = maxOf(ptsMs * 1000, lastPtsUs + 1000)
    writer.drawFrame(bitmap, ptsUs * 1000)
    lastPtsUs = ptsUs
    drainEncoder(endOfStream = false)
  }

  // Standard grafika EncodeAndMux drain: copy every ready output buffer into the muxer,
  // starting it on the first (and only) format change.
  private fun drainEncoder(endOfStream: Boolean) {
    val encoder = codec ?: return
    if (endOfStream) encoder.signalEndOfInputStream()
    while (true) {
      val status = encoder.dequeueOutputBuffer(bufferInfo, if (endOfStream) 10_000L else 0L)
      when {
        status == MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!endOfStream) return
          // Keep waiting for the end-of-stream flag to flush through.
        }
        status == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          check(!muxerStarted) { "encoder output format changed twice" }
          trackIndex = muxer!!.addTrack(encoder.outputFormat)
          muxer!!.start()
          muxerStarted = true
        }
        status >= 0 -> {
          val data = encoder.getOutputBuffer(status) ?: throw IllegalStateException("null output buffer")
          // Codec config bytes already live in the muxer's track format.
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) bufferInfo.size = 0
          if (bufferInfo.size > 0 && muxerStarted) {
            data.position(bufferInfo.offset)
            data.limit(bufferInfo.offset + bufferInfo.size)
            muxer!!.writeSampleData(trackIndex, data, bufferInfo)
          }
          encoder.releaseOutputBuffer(status, false)
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
      }
    }
  }

  private fun releaseCodecAndGl() {
    try {
      codec?.stop()
    } catch (_: Throwable) {}
    try {
      codec?.release()
    } catch (_: Throwable) {}
    codec = null
    gl?.release()
    gl = null
  }

  private fun releaseAll() {
    releaseCodecAndGl()
    try {
      if (muxerStarted) muxer?.stop()
    } catch (_: Throwable) {}
    try {
      muxer?.release()
    } catch (_: Throwable) {}
    muxer = null
    muxerStarted = false
    recycleBitmap()
  }

  private fun recycleBitmap() {
    lastBitmap?.recycle()
    lastBitmap = null
  }
}
