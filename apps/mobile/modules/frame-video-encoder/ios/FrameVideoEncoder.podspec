Pod::Spec.new do |s|
  s.name           = 'FrameVideoEncoder'
  s.version        = '1.0.0'
  s.summary        = 'On-device MP4 encoder for captured frame sequences'
  s.description    = 'Encodes a sequence of frame images into an H.264 MP4 with explicit presentation timestamps (variable frame rate).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
