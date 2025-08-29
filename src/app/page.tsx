'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

type RecordingState = 'idle' | 'recording' | 'stopped'

interface TranscriptionSegment {
  text: string
  speakerId: string
}

interface TranscriptionResponse {
  segments: TranscriptionSegment[]
}

export default function Home() {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcription, setTranscription] = useState<TranscriptionSegment[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showTranscription, setShowTranscription] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [bufferedDuration, setBufferedDuration] = useState(0)
  const [bufferLimitSeconds, setBufferLimitSeconds] = useState(5)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<{ blob: Blob; timestamp: number }[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const fileExtensionRef = useRef<string>('webm')
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [])
  
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      // Try formats supported by both browser and backend
      let mimeType = 'audio/webm' // fallback
      let fileExtension = 'webm'
      
      // Backend supports: WAV, MP3, M4A, FLAC, OGG, AAC
      if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
        mimeType = 'audio/ogg; codecs=opus'
        fileExtension = 'ogg'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
        fileExtension = 'm4a'
      } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        mimeType = 'audio/mpeg'
        fileExtension = 'mp3'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
        fileExtension = 'ogg'
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      fileExtensionRef.current = fileExtension
      
      // Set up audio analysis for visualization
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      
      // Start audio level animation
      const animate = () => {
        if (!analyserRef.current) return
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        
        // Calculate average audio level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
        const normalizedLevel = Math.min(average / 128, 1) // Normalize to 0-1
        
        setAudioLevel(normalizedLevel)
        animationFrameRef.current = requestAnimationFrame(animate)
      }
      animate()
      
      // Start recording timer
      setRecordingTime(0)
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const timestamp = Date.now()
          audioChunksRef.current.push({ blob: event.data, timestamp })
          
          // Keep only the latest X seconds of audio based on user selection
          const bufferLimitMs = bufferLimitSeconds * 1000
          const cutoffTime = timestamp - bufferLimitMs
          audioChunksRef.current = audioChunksRef.current.filter(chunk => chunk.timestamp >= cutoffTime)
          
          // Update buffered duration
          const oldestTimestamp = audioChunksRef.current.length > 0 ? audioChunksRef.current[0].timestamp : timestamp
          const duration = Math.min((timestamp - oldestTimestamp) / 1000, bufferLimitSeconds)
          setBufferedDuration(duration)
        }
      }
      
      mediaRecorder.start(100) // Record in 100ms intervals
      setState('recording')
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Error accessing microphone. Please ensure you have granted microphone permissions.')
    }
  }, [bufferLimitSeconds])
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && streamRef.current) {
      mediaRecorderRef.current.stop()
      streamRef.current.getTracks().forEach(track => track.stop())
      setState('stopped')
      
      // Clean up audio analysis
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      
      setAudioLevel(0)
      setBufferedDuration(0)
    }
  }, [])
  


  const transcribeAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      alert('No audio recorded')
      return
    }
    
    setIsTranscribing(true)
    
    try {
      // Stop recording if still recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        stopRecording()
        // Wait a bit for the recording to stop
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // Create audio blob from the latest X seconds of chunks based on user selection
      const currentTime = Date.now()
      const bufferLimitMs = bufferLimitSeconds * 1000
      const cutoffTime = currentTime - bufferLimitMs
      const recentChunks = audioChunksRef.current
        .filter(chunk => chunk.timestamp >= cutoffTime)
        .map(chunk => chunk.blob)
      
      if (recentChunks.length === 0) {
        alert('No recent audio data available')
        return
      }
      
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
      const audioBlob = new Blob(recentChunks, { type: mimeType })
      
      console.log(`Sending ${recentChunks.length} audio chunks covering ${bufferedDuration.toFixed(1)} seconds (${bufferLimitSeconds}s limit) to API`)
      console.log(`Audio blob size: ${(audioBlob.size / 1024).toFixed(1)} KB`)
      
      // Create FormData to send the file
      const formData = new FormData()
      formData.append('audioFile', audioBlob, `recording.${fileExtensionRef.current}`)
      
      // Send to API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transcription/transcribe`, {
      method: 'POST',
      body: formData,
      })
      
      console.log('Response status:', response.status)
      console.log('Response OK:', response.ok)
      
      if (response.ok) {
        const responseText = await response.text()
        console.log('Raw response:', responseText)
        
        const result: TranscriptionResponse = JSON.parse(responseText)
        console.log('Parsed result:', result)
        
        setTranscription(result.segments)
        setShowTranscription(true)
      } else {
        const errorText = await response.text()
        console.log('Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      alert('Error transcribing audio. Please ensure the API server is running.')
    } finally {
      setIsTranscribing(false)
    }
  }, [stopRecording, bufferedDuration, bufferLimitSeconds])
  
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Minimal Header */}
        <div className="flex items-center justify-between mb-16 pt-8">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
            <span className="text-xl font-light text-gray-100">Listener</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${
            state === 'recording' ? 'bg-red-500 animate-pulse' : 
            state === 'stopped' ? 'bg-yellow-500' : 'bg-gray-600'
          }`}></div>
        </div>

        {/* Minimal Hero */}
        <div className="text-center mb-20">
          <h1 className="text-5xl font-thin text-white mb-4 tracking-wide">
            Voice to
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-extralight"> Intelligence</span>
          </h1>
        </div>
        
        {/* Main Control Center */}
        <div className="relative">
          {/* Central Recording Interface */}
          <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 rounded-2xl p-8 mb-8">
            <div className="text-center space-y-8">              
              {/* Status */}
              <div className="mb-8">
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                  state === 'recording' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                  state === 'stopped' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
                  'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                  {state === 'recording' ? 'Recording' : 
                   state === 'stopped' ? 'Ready' : 'Standby'}
                </div>
              </div>
              
              {/* Main Controls */}
              {state === 'idle' && (
                <button
                  onClick={startRecording}
                  className="group w-32 h-32 mx-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-full transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  <svg className="w-12 h-12 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </button>
              )}
              
              {state === 'recording' && (
                <div className="space-y-8">
                  {/* Audio Visualization */}
                  <div className="flex flex-col items-center space-y-6">
                    {/* Timer and Buffer Info */}
                    <div className="text-2xl font-mono text-white">
                      {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                      {(recordingTime % 60).toString().padStart(2, '0')}
                    </div>
                    
                    <div className="text-sm text-gray-400">
                      Buffer: {bufferedDuration.toFixed(1)}s / {bufferLimitSeconds}s
                    </div>
                    
                    {/* Audio Waveform Visualization */}
                    <div className="flex items-center justify-center space-x-1 h-16">
                      {Array.from({ length: 20 }, (_, i) => {
                        const delay = i * 0.1
                        const height = Math.max(4, audioLevel * 60 + Math.sin(Date.now() * 0.01 + delay) * 10)
                        return (
                          <div
                            key={i}
                            className="w-1 bg-gradient-to-t from-red-600 to-red-400 rounded-full transition-all duration-100"
                            style={{
                              height: `${height}px`,
                              opacity: 0.7 + audioLevel * 0.3
                            }}
                          />
                        )
                      })}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-red-400">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-lg font-medium">Recording</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-6">
                    <button
                      onClick={stopRecording}
                      className="w-16 h-16 bg-gray-700 hover:bg-gray-600 rounded-full transition-all duration-300 flex items-center justify-center"
                    >
                      <div className="w-4 h-4 bg-white rounded-sm"></div>
                    </button>
                    
                    <button
                      onClick={transcribeAudio}
                      disabled={isTranscribing}
                      className="w-16 h-16 bg-green-600 hover:bg-green-500 disabled:bg-green-400 rounded-full transition-all duration-300 flex items-center justify-center disabled:cursor-not-allowed"
                    >
                      {isTranscribing ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {state === 'stopped' && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="text-lg text-gray-300 mb-6">Audio captured</div>
                    <div className="flex justify-center space-x-6">
                      <button
                        onClick={startRecording}
                        className="w-16 h-16 bg-blue-600 hover:bg-blue-500 rounded-full transition-all duration-300 flex items-center justify-center"
                      >
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                      </button>
                      
                      <button
                        onClick={transcribeAudio}
                        disabled={isTranscribing}
                        className="w-16 h-16 bg-green-600 hover:bg-green-500 disabled:bg-green-400 rounded-full transition-all duration-300 flex items-center justify-center disabled:cursor-not-allowed"
                      >
                        {isTranscribing ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Buffer Duration Selector */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Buffer Duration</label>
                <select
                  value={bufferLimitSeconds}
                  onChange={(e) => setBufferLimitSeconds(Number(e.target.value))}
                  className={`rounded-xl px-4 py-2 text-sm focus:outline-none transition-colors ${
                    isTranscribing || state === 'recording'
                      ? 'bg-gray-900 border border-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white cursor-pointer focus:border-blue-500'
                  }`}
                  disabled={isTranscribing || state === 'recording'}
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={25}>25 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Latest Transcription Preview */}
          {transcription.length > 0 && !showTranscription && (
            <div className="bg-gray-900/30 backdrop-blur-md border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400 text-sm">Latest result</span>
                <button
                  onClick={() => setShowTranscription(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  View all →
                </button>
              </div>
              <p className="text-gray-300 text-sm line-clamp-2">
                {transcription[0]?.text?.length > 100 
                  ? transcription[0].text.substring(0, 100) + '...' 
                  : transcription[0]?.text || 'No transcription available'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Transcription Modal - Minimal */}
      {showTranscription && transcription.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-light text-white">Transcription</h2>
              <button
                onClick={() => setShowTranscription(false)}
                className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96 space-y-4">
              {transcription.map((segment, index) => (
                <div key={index} className={`flex ${segment.speakerId === 'A' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-xs px-4 py-3 rounded-2xl ${
                    segment.speakerId === 'A' 
                      ? 'bg-gray-800 text-gray-100' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    <div className="text-xs text-gray-400 mb-1">Speaker {segment.speakerId}</div>
                    <p className="text-sm">{segment.text}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-4 p-6 border-t border-gray-800">
              <button
                onClick={() => navigator.clipboard.writeText(transcription.map(s => `Speaker ${s.speakerId}: ${s.text}`).join('\n\n'))}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl text-sm transition-all duration-200"
              >
                Copy
              </button>
              <button
                onClick={() => setShowTranscription(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl text-sm transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
