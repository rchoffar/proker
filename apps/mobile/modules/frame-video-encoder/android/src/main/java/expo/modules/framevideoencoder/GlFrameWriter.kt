package expo.modules.framevideoencoder

import android.graphics.Bitmap
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES20
import android.opengl.GLUtils
import android.view.Surface
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

// Draws bitmaps aspect-fit on black into a MediaCodec input surface, stamping each swap
// with an explicit presentation time (eglPresentationTimeANDROID) — the piece MediaCodec
// needs for variable-frame-rate input. Must be created, used, and released on one thread.
class GlFrameWriter(surface: Surface, private val width: Int, private val height: Int) {
  private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
  private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
  private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE
  private var program = 0
  private var textureId = 0
  private var positionHandle = 0
  private var texCoordHandle = 0

  private val vertexBuffer: FloatBuffer =
    ByteBuffer.allocateDirect(8 * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()

  // Bitmap row 0 is the image top, GL texcoord v=0 is the texture's first row: mapping the
  // quad's top vertices to v=0 renders the image upright in the encoded frame.
  private val texCoordBuffer: FloatBuffer =
    ByteBuffer.allocateDirect(8 * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
      put(floatArrayOf(0f, 1f, 1f, 1f, 0f, 0f, 1f, 0f))
      position(0)
    }

  init {
    eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
    check(eglDisplay !== EGL14.EGL_NO_DISPLAY) { "eglGetDisplay failed" }
    val version = IntArray(2)
    check(EGL14.eglInitialize(eglDisplay, version, 0, version, 1)) { "eglInitialize failed" }

    val attribList = intArrayOf(
      EGL14.EGL_RED_SIZE, 8,
      EGL14.EGL_GREEN_SIZE, 8,
      EGL14.EGL_BLUE_SIZE, 8,
      EGL14.EGL_ALPHA_SIZE, 8,
      EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
      EGL_RECORDABLE_ANDROID, 1,
      EGL14.EGL_NONE,
    )
    val configs = arrayOfNulls<EGLConfig>(1)
    val numConfigs = IntArray(1)
    check(EGL14.eglChooseConfig(eglDisplay, attribList, 0, configs, 0, 1, numConfigs, 0) && numConfigs[0] > 0) {
      "no recordable EGL config"
    }
    val config = configs[0]!!

    eglContext = EGL14.eglCreateContext(
      eglDisplay, config, EGL14.EGL_NO_CONTEXT,
      intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0
    )
    check(eglContext !== EGL14.EGL_NO_CONTEXT) { "eglCreateContext failed" }

    eglSurface = EGL14.eglCreateWindowSurface(eglDisplay, config, surface, intArrayOf(EGL14.EGL_NONE), 0)
    check(eglSurface !== EGL14.EGL_NO_SURFACE) { "eglCreateWindowSurface failed" }
    check(EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) { "eglMakeCurrent failed" }

    program = buildProgram()
    positionHandle = GLES20.glGetAttribLocation(program, "aPos")
    texCoordHandle = GLES20.glGetAttribLocation(program, "aTex")

    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    textureId = textures[0]
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)

    GLES20.glViewport(0, 0, width, height)
    GLES20.glClearColor(0f, 0f, 0f, 1f)
  }

  fun drawFrame(bitmap: Bitmap, ptsNs: Long) {
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
    GLES20.glUseProgram(program)

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)

    // Aspect-fit: quad extents in normalized device coordinates.
    val scale = minOf(width.toFloat() / bitmap.width, height.toFloat() / bitmap.height)
    val sx = bitmap.width * scale / width
    val sy = bitmap.height * scale / height
    vertexBuffer.clear()
    vertexBuffer.put(floatArrayOf(-sx, -sy, sx, -sy, -sx, sy, sx, sy))
    vertexBuffer.position(0)

    GLES20.glEnableVertexAttribArray(positionHandle)
    GLES20.glVertexAttribPointer(positionHandle, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer)
    GLES20.glEnableVertexAttribArray(texCoordHandle)
    GLES20.glVertexAttribPointer(texCoordHandle, 2, GLES20.GL_FLOAT, false, 0, texCoordBuffer)

    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

    GLES20.glDisableVertexAttribArray(positionHandle)
    GLES20.glDisableVertexAttribArray(texCoordHandle)

    EGLExt.eglPresentationTimeANDROID(eglDisplay, eglSurface, ptsNs)
    check(EGL14.eglSwapBuffers(eglDisplay, eglSurface)) { "eglSwapBuffers failed" }
  }

  fun release() {
    if (eglDisplay !== EGL14.EGL_NO_DISPLAY) {
      EGL14.eglMakeCurrent(eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
      if (eglSurface !== EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(eglDisplay, eglSurface)
      if (eglContext !== EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(eglDisplay, eglContext)
      EGL14.eglTerminate(eglDisplay)
    }
    eglDisplay = EGL14.EGL_NO_DISPLAY
    eglContext = EGL14.EGL_NO_CONTEXT
    eglSurface = EGL14.EGL_NO_SURFACE
  }

  private fun buildProgram(): Int {
    val vertexShader = compileShader(
      GLES20.GL_VERTEX_SHADER,
      """
      attribute vec2 aPos;
      attribute vec2 aTex;
      varying vec2 vTex;
      void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
        vTex = aTex;
      }
      """
    )
    val fragmentShader = compileShader(
      GLES20.GL_FRAGMENT_SHADER,
      """
      precision mediump float;
      varying vec2 vTex;
      uniform sampler2D uTex;
      void main() {
        gl_FragColor = texture2D(uTex, vTex);
      }
      """
    )
    val program = GLES20.glCreateProgram()
    GLES20.glAttachShader(program, vertexShader)
    GLES20.glAttachShader(program, fragmentShader)
    GLES20.glLinkProgram(program)
    val linked = IntArray(1)
    GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, linked, 0)
    check(linked[0] == GLES20.GL_TRUE) { "program link failed: ${GLES20.glGetProgramInfoLog(program)}" }
    GLES20.glDeleteShader(vertexShader)
    GLES20.glDeleteShader(fragmentShader)
    return program
  }

  private fun compileShader(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type)
    GLES20.glShaderSource(shader, source)
    GLES20.glCompileShader(shader)
    val compiled = IntArray(1)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
    check(compiled[0] == GLES20.GL_TRUE) { "shader compile failed: ${GLES20.glGetShaderInfoLog(shader)}" }
    return shader
  }

  private companion object {
    // From EGL_ANDROID_recordable — not exposed as an EGL14 constant.
    const val EGL_RECORDABLE_ANDROID = 0x3142
  }
}
