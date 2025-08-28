'use client'

import { useState, useRef, useCallback } from 'react'

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const fileExtensionRef = useRef<string>('webm')
  
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
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          
          // Keep only the latest 30 seconds of audio
          // Assuming each chunk is ~100ms, we want ~300 chunks for 30 seconds
          if (audioChunksRef.current.length > 300) {
            audioChunksRef.current = audioChunksRef.current.slice(-300)
          }
        }
      }
      
      mediaRecorder.start(100) // Record in 100ms intervals
      setState('recording')
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Error accessing microphone. Please ensure you have granted microphone permissions.')
    }
  }, [])
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && streamRef.current) {
      mediaRecorderRef.current.stop()
      streamRef.current.getTracks().forEach(track => track.stop())
      setState('stopped')
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
      
      // Create audio blob from the latest 30 seconds
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
      
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
  }, [stopRecording])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Main Control Panel */}
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Voice Transcription
          </h1>
          <p className="text-gray-600">
            Record and transcribe speech in real-time
          </p>
        </div>
        
        {/* Recording Control Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center space-y-6">
            {/* Status Indicator */}
            <div className="flex items-center justify-center space-x-3">
              <div className={`w-4 h-4 rounded-full ${
                state === 'recording' ? 'bg-red-500 animate-pulse' : 
                state === 'stopped' ? 'bg-yellow-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-lg font-medium text-gray-700">
                {state === 'recording' ? 'Recording Active' : 
                 state === 'stopped' ? 'Audio Ready' : 'Ready to Record'}
              </span>
            </div>
            
            {/* Main Controls */}
            {state === 'idle' && (
              <button
                onClick={startRecording}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                🎤 Start Listening
              </button>
            )}
            
            {state === 'recording' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 text-sm font-medium">
                    📍 Recording last 30 seconds...
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={stopRecording}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    ⏹️ Stop
                  </button>
                  
                  <button
                    onClick={transcribeAudio}
                    disabled={isTranscribing}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-green-400 disabled:to-green-500 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                  >
                    {isTranscribing ? '⏳' : '📝'} {isTranscribing ? 'Processing...' : 'Transcribe'}
                  </button>
                </div>
              </div>
            )}
            
            {state === 'stopped' && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-700 text-sm font-medium">
                    ⏸️ Recording paused - 30 seconds ready for transcription
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={startRecording}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                  >
                    🎤 Resume
                  </button>
                  
                  <button
                    onClick={transcribeAudio}
                    disabled={isTranscribing}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-green-400 disabled:to-green-500 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                  >
                    {isTranscribing ? '⏳' : '📝'} {isTranscribing ? 'Processing...' : 'Transcribe'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Transcription History */}
        {transcription.length > 0 && !showTranscription && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Latest Transcription</h3>
              <button
                onClick={() => setShowTranscription(true)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                View Full ➤
              </button>
            </div>
            <p className="text-gray-800 leading-relaxed line-clamp-3">
              {transcription[0]?.text?.length > 150 
                ? transcription[0].text.substring(0, 150) + '...' 
                : transcription[0]?.text || 'No transcription available'}
            </p>
          </div>
        )}
      </div>
      
      {/* Transcription Results Modal */}
      {showTranscription && transcription.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">📝 Transcription Result</h2>
                <button
                  onClick={() => setShowTranscription(false)}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96 bg-gray-50">
              <div className="space-y-3">
                {transcription.map((segment, index) => (
                  <div key={index} className={`flex ${segment.speakerId === 'A' ? 'justify-start' : 'justify-end'} mb-2`}>
                    <div className={`relative max-w-xs lg:max-w-sm px-4 py-3 rounded-2xl shadow-sm ${
                      segment.speakerId === 'A' 
                        ? 'bg-white text-gray-800 rounded-bl-md' 
                        : 'bg-blue-500 text-white rounded-br-md ml-auto'
                    }`}>
                      {/* Speaker label */}
                      <div className={`text-xs font-semibold mb-1 ${
                        segment.speakerId === 'A' ? 'text-gray-500' : 'text-blue-100'
                      }`}>
                        Speaker {segment.speakerId}
                      </div>
                      
                      {/* Message content */}
                      <p className="text-sm leading-relaxed">
                        {segment.text}
                      </p>
                      
                      {/* Chat bubble tail */}
                      <div className={`absolute top-2 w-3 h-3 ${
                        segment.speakerId === 'A' 
                          ? '-left-1 bg-white transform rotate-45' 
                          : '-right-1 bg-blue-500 transform rotate-45'
                      }`}></div>
                    </div>
                  </div>
                ))}
                
                {/* Empty state */}
                {transcription.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No messages to display</p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => navigator.clipboard.writeText(transcription.map(s => `${s.speakerId}: ${s.text}`).join('\n'))}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => setShowTranscription(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
