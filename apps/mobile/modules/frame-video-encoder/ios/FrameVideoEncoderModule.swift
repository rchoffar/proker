import AVFoundation
import ExpoModulesCore
import UIKit

struct SessionOptions: Record {
  @Field var width: Int = 1080
  @Field var height: Int = 1920
  @Field var bitRate: Int = 8_000_000
}

enum EncoderError: Error, LocalizedError {
  case noSession
  case noFrameYet
  case badImage(String)
  case writerFailed(String)

  var errorDescription: String? {
    switch self {
    case .noSession: return "No encoding session — call createSession first"
    case .noFrameYet: return "repeatLastFrame called before any appendFrame"
    case .badImage(let uri): return "Could not decode frame image at \(uri)"
    case .writerFailed(let reason): return "Video writer failed: \(reason)"
    }
  }
}

// Encodes a sequence of frame images into an H.264 MP4 with explicit presentation
// timestamps (variable frame rate — the replay export captures frames at whatever cadence
// the JS side manages and retimes them here). All calls are serialized on one queue so JS
// can fire appendFrame without awaiting each one; errors surface on the call's promise.
public class FrameVideoEncoderModule: Module {
  private let queue = DispatchQueue(label: "fr.upk.frame-video-encoder")
  private var session: EncodingSession?

  public func definition() -> ModuleDefinition {
    Name("FrameVideoEncoder")

    AsyncFunction("createSession") { (options: SessionOptions, promise: Promise) in
      self.queue.async {
        self.session?.abort()
        do {
          self.session = try EncodingSession(width: options.width, height: options.height, bitRate: options.bitRate)
          promise.resolve()
        } catch {
          self.session = nil
          promise.reject(error)
        }
      }
    }

    AsyncFunction("appendFrame") { (uri: String, ptsMs: Double, promise: Promise) in
      self.queue.async {
        do {
          guard let session = self.session else { throw EncoderError.noSession }
          try session.appendFrame(uri: uri, ptsMs: Int64(ptsMs.rounded()))
          promise.resolve()
        } catch {
          promise.reject(error)
        }
      }
    }

    AsyncFunction("repeatLastFrame") { (ptsMs: Double, promise: Promise) in
      self.queue.async {
        do {
          guard let session = self.session else { throw EncoderError.noSession }
          try session.repeatLastFrame(ptsMs: Int64(ptsMs.rounded()))
          promise.resolve()
        } catch {
          promise.reject(error)
        }
      }
    }

    AsyncFunction("finish") { (endMs: Double, promise: Promise) in
      self.queue.async {
        guard let session = self.session else {
          promise.reject(EncoderError.noSession)
          return
        }
        self.session = nil
        session.finish(endMs: Int64(endMs.rounded())) { result in
          switch result {
          case .success(let url): promise.resolve(url.absoluteString)
          case .failure(let error): promise.reject(error)
          }
        }
      }
    }

    AsyncFunction("abort") { (promise: Promise) in
      self.queue.async {
        self.session?.abort()
        self.session = nil
        promise.resolve()
      }
    }
  }
}

// One MP4 being written. Owned by the module's serial queue — nothing here is thread-safe
// on its own.
private final class EncodingSession {
  private let writer: AVAssetWriter
  private let input: AVAssetWriterInput
  private let adaptor: AVAssetWriterInputPixelBufferAdaptor
  private let width: Int
  private let height: Int
  private let outputURL: URL
  // Timestamps are forced strictly monotonic: two frames on the same millisecond would
  // make AVAssetWriter drop the session.
  private var lastPtsMs: Int64 = -1
  // Kept for repeatLastFrame — never written to again, so re-appending it is safe even
  // while the encoder still reads it.
  private var lastBuffer: CVPixelBuffer?

  init(width: Int, height: Int, bitRate: Int) throws {
    self.width = width
    self.height = height
    outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("upk-replay-\(Int(Date().timeIntervalSince1970 * 1000)).mp4")
    try? FileManager.default.removeItem(at: outputURL)
    writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
    let settings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitRate,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalDurationKey: 1,
      ],
    ]
    input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    // Pull model: appends block until the input drains instead of dropping frames.
    input.expectsMediaDataInRealTime = false
    adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ]
    )
    guard writer.canAdd(input) else { throw EncoderError.writerFailed("cannot add video input") }
    writer.add(input)
    guard writer.startWriting() else {
      throw EncoderError.writerFailed(writer.error?.localizedDescription ?? "startWriting")
    }
    writer.startSession(atSourceTime: .zero)
  }

  func appendFrame(uri: String, ptsMs: Int64) throws {
    let path = uri.hasPrefix("file://") ? (URL(string: uri)?.path ?? uri) : uri
    guard let cg = UIImage(contentsOfFile: path)?.cgImage else { throw EncoderError.badImage(uri) }
    try append(buffer: try makeBuffer(from: cg), ptsMs: ptsMs)
  }

  func repeatLastFrame(ptsMs: Int64) throws {
    guard let buffer = lastBuffer else { throw EncoderError.noFrameYet }
    try append(buffer: buffer, ptsMs: ptsMs)
  }

  func finish(endMs: Int64, completion: @escaping (Result<URL, Error>) -> Void) {
    guard writer.status == .writing else {
      let error = writer.error ?? EncoderError.writerFailed("writer status \(writer.status.rawValue)")
      abort()
      completion(.failure(error))
      return
    }
    // endSession extends the last appended frame up to the requested end time.
    writer.endSession(atSourceTime: CMTime(value: max(endMs, lastPtsMs + 1), timescale: 1000))
    input.markAsFinished()
    let url = outputURL
    writer.finishWriting { [writer] in
      if writer.status == .completed {
        completion(.success(url))
      } else {
        completion(.failure(writer.error ?? EncoderError.writerFailed("finishWriting")))
      }
    }
  }

  func abort() {
    if writer.status == .writing {
      input.markAsFinished()
      writer.cancelWriting()
    }
    try? FileManager.default.removeItem(at: outputURL)
  }

  private func append(buffer: CVPixelBuffer, ptsMs: Int64) throws {
    guard writer.status == .writing else {
      throw EncoderError.writerFailed(writer.error?.localizedDescription ?? "writer status \(writer.status.rawValue)")
    }
    let pts = max(ptsMs, lastPtsMs + 1)
    while !input.isReadyForMoreMediaData {
      Thread.sleep(forTimeInterval: 0.002)
    }
    guard adaptor.append(buffer, withPresentationTime: CMTime(value: pts, timescale: 1000)) else {
      throw EncoderError.writerFailed(writer.error?.localizedDescription ?? "append")
    }
    lastPtsMs = pts
    lastBuffer = buffer
  }

  // Frame images vary in size (table frames vs recap card): each is aspect-fit centered
  // onto a black canvas at the output dimensions.
  private func makeBuffer(from cg: CGImage) throws -> CVPixelBuffer {
    guard let pool = adaptor.pixelBufferPool else { throw EncoderError.writerFailed("no pixel buffer pool") }
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBuffer)
    guard let buffer = pixelBuffer else { throw EncoderError.writerFailed("pixel buffer allocation") }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let ctx = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { throw EncoderError.writerFailed("CGContext creation") }
    ctx.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    let scale = min(CGFloat(width) / CGFloat(cg.width), CGFloat(height) / CGFloat(cg.height))
    let fitW = CGFloat(cg.width) * scale
    let fitH = CGFloat(cg.height) * scale
    ctx.interpolationQuality = .high
    ctx.draw(cg, in: CGRect(x: (CGFloat(width) - fitW) / 2, y: (CGFloat(height) - fitH) / 2, width: fitW, height: fitH))
    return buffer
  }
}
