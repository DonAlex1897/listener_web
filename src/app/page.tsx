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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50 p-6">
      {/* Navigation */}
      <nav className="max-w-6xl mx-auto mb-12 flex justify-between items-center bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-sm border border-white/20">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">L</span>
          </div>
          <div>
            <span className="text-xl font-bold text-gray-900">Listener</span>
            <p className="text-xs text-gray-500 -mt-0.5">Voice Intelligence Platform</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
            v1.0
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-3 bg-blue-50 text-blue-700 px-5 py-3 rounded-full text-sm font-semibold mb-8 border border-blue-200">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Advanced Voice Transcription Technology</span>
          </div>
          
          <h1 className="text-6xl font-bold text-gray-900 mb-6 tracking-tight leading-tight">
            Transform Speech into
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 block"> Intelligent Text</span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8">
            Experience state-of-the-art speech recognition with real-time speaker identification. 
            Record conversations and receive instant, accurate transcriptions with professional-grade quality.
          </p>
          
          <div className="flex justify-center items-center space-x-8 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Real-time Processing</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20a3 3 0 01-3-3v-2a3 3 0 013-3m3-3a3 3 0 110-6 3 3 0 010 6m0 3a3 3 0 110-6 3 3 0 010 6m3 3h3m-3 0l-.025-.5a5.56 5.56 0 010-3l.025-.5"/>
              </svg>
              <span>Speaker Identification</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <span>Enterprise Security</span>
            </div>
          </div>
        </div>
        
        {/* Main Control Panel */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recording Control Card */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden hover:shadow-3xl transition-all duration-300">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-gray-50/90 to-gray-100/90 backdrop-blur-sm px-8 py-6 border-b border-gray-200/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Recording Studio</h2>
                    <p className="text-gray-600 text-sm">Capture and process your audio with precision</p>
                  </div>
                  <div className={`flex items-center space-x-3 px-4 py-2.5 rounded-full border-2 transition-all duration-300 ${
                    state === 'recording' ? 'bg-red-50 border-red-200 shadow-red-100' : 
                    state === 'stopped' ? 'bg-amber-50 border-amber-200 shadow-amber-100' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      state === 'recording' ? 'bg-red-500 animate-pulse shadow-red-300 shadow-lg' : 
                      state === 'stopped' ? 'bg-amber-500 shadow-amber-300 shadow-sm' : 'bg-slate-400'
                    }`}></div>
                    <span className={`text-sm font-bold tracking-wide ${
                      state === 'recording' ? 'text-red-700' : 
                      state === 'stopped' ? 'text-amber-700' : 'text-slate-700'
                    }`}>
                      {state === 'recording' ? 'RECORDING' : 
                       state === 'stopped' ? 'READY' : 'STANDBY'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-10">
                <div className="text-center space-y-8">
                  {/* Status Display */}
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-8 border border-gray-100">
                    <div className="text-xl font-semibold text-gray-900 mb-3">
                      {state === 'recording' ? '🎙️ Recording in Progress' : 
                       state === 'stopped' ? '✅ Audio Captured Successfully' : '🎯 Ready to Begin Recording'}
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
                      {state === 'recording' ? 'Continuously capturing the last 30 seconds of audio with high-quality compression' : 
                       state === 'stopped' ? '30 seconds of high-quality audio ready for AI-powered transcription' : 'Click the start button below to begin capturing audio from your microphone'}
                    </div>
                  </div>
                  
                  {/* Main Controls */}
                  {state === 'idle' && (
                    <button
                      onClick={startRecording}
                      className="group relative w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-white font-bold py-8 px-10 rounded-2xl transition-all duration-500 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/25 focus:outline-none focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-center space-x-4">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all duration-300 group-hover:scale-110">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                          </svg>
                        </div>
                        <span className="text-xl">Start Recording Session</span>
                      </div>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-2xl transition-all duration-300"></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 rounded-2xl"></div>
                    </button>
                  )}
                  
                  {state === 'recording' && (
                    <div className="space-y-8">
                      <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-6 shadow-red-100 shadow-lg">
                        <div className="flex items-center justify-center space-x-3 text-red-700">
                          <div className="w-5 h-5 bg-red-500 rounded-full animate-pulse shadow-red-300 shadow-lg"></div>
                          <span className="font-bold text-lg">Recording Active</span>
                          <span className="text-sm bg-red-100 px-3 py-1 rounded-full font-medium">Buffer: 30s</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <button
                          onClick={stopRecording}
                          className="group bg-slate-700 hover:bg-slate-800 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-slate-500/25 focus:outline-none focus:ring-4 focus:ring-slate-500/30 active:scale-95"
                        >
                          <div className="flex items-center justify-center space-x-3">
                            <div className="w-4 h-4 bg-white rounded-sm group-hover:scale-110 transition-transform"></div>
                            <span className="text-lg">Stop Recording</span>
                          </div>
                        </button>
                        
                        <button
                          onClick={transcribeAudio}
                          disabled={isTranscribing}
                          className="group bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 disabled:from-green-400 disabled:to-green-500 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/25 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95 disabled:active:scale-100"
                        >
                          <div className="flex items-center justify-center space-x-3">
                            {isTranscribing ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                              </svg>
                            )}
                            <span className="text-lg">{isTranscribing ? 'Processing...' : 'Transcribe Now'}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {state === 'stopped' && (
                    <div className="space-y-8">
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6 shadow-amber-100 shadow-lg">
                        <div className="flex items-center justify-center space-x-3 text-amber-700">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                          </svg>
                          <span className="font-bold text-lg">Audio Ready for Processing</span>
                          <span className="text-sm bg-amber-100 px-3 py-1 rounded-full font-medium">30s captured</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <button
                          onClick={startRecording}
                          className="group bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25 focus:outline-none focus:ring-4 focus:ring-blue-500/30 active:scale-95"
                        >
                          <div className="flex items-center justify-center space-x-3">
                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                            <span className="text-lg">Resume Recording</span>
                          </div>
                        </button>
                        
                        <button
                          onClick={transcribeAudio}
                          disabled={isTranscribing}
                          className="group bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 disabled:from-green-400 disabled:to-green-500 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/25 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95 disabled:active:scale-100"
                        >
                          <div className="flex items-center justify-center space-x-3">
                            {isTranscribing ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                              </svg>
                            )}
                            <span className="text-lg">{isTranscribing ? 'Processing...' : 'Transcribe Audio'}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Sidebar - Features and Status */}
          <div className="space-y-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                Key Features
              </h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4 p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-2 flex-shrink-0 shadow-green-300 shadow-sm"></div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm mb-1">Speaker Identification</div>
                    <div className="text-gray-600 text-xs leading-relaxed">Advanced AI distinguishes between multiple speakers with 95% accuracy</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0 shadow-blue-300 shadow-sm"></div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm mb-1">Real-time Processing</div>
                    <div className="text-gray-600 text-xs leading-relaxed">30-second rolling buffer with instant transcription capabilities</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mt-2 flex-shrink-0 shadow-purple-300 shadow-sm"></div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm mb-1">Format Support</div>
                    <div className="text-gray-600 text-xs leading-relaxed">Compatible with WAV, MP3, OGG, M4A, FLAC, and AAC formats</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="w-3 h-3 bg-orange-500 rounded-full mt-2 flex-shrink-0 shadow-orange-300 shadow-sm"></div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm mb-1">Privacy-First</div>
                    <div className="text-gray-600 text-xs leading-relaxed">All processing happens securely with enterprise-grade encryption</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Latest Transcription Preview */}
            {transcription.length > 0 && !showTranscription && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    Latest Result
                  </h3>
                  <button
                    onClick={() => setShowTranscription(true)}
                    className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center space-x-2 group bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all duration-200"
                  >
                    <span>View Full</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                    </svg>
                  </button>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-100">
                  <p className="text-gray-800 text-sm leading-relaxed line-clamp-4 mb-4">
                    {transcription[0]?.text?.length > 120 
                      ? transcription[0].text.substring(0, 120) + '...' 
                      : transcription[0]?.text || 'No transcription available'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      Speaker {transcription[0]?.speakerId}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Statistics Card */}
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-3xl shadow-xl border border-gray-200 p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                </div>
                Session Stats
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-white rounded-xl border border-gray-200">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {state === 'recording' ? '🔴' : state === 'stopped' ? '⏸️' : '⏹️'}
                  </div>
                  <div className="text-xs text-gray-600">Current Status</div>
                </div>
                <div className="text-center p-4 bg-white rounded-xl border border-gray-200">
                  <div className="text-2xl font-bold text-emerald-600 mb-1">{transcription.length}</div>
                  <div className="text-xs text-gray-600">Segments</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Transcription Results Modal */}
      {showTranscription && transcription.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden transform scale-100 animate-slideUp">
            <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 text-white p-8 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h2 className="text-3xl font-bold mb-2">📝 Transcription Results</h2>
                  <p className="text-emerald-100 text-sm">AI-powered speech-to-text conversion complete</p>
                </div>
                <button
                  onClick={() => setShowTranscription(false)}
                  className="text-white hover:text-emerald-200 text-3xl font-light hover:bg-white/10 w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-96 bg-gradient-to-b from-gray-50 to-white">
              <div className="space-y-4">
                {transcription.map((segment, index) => (
                  <div key={index} className={`flex ${segment.speakerId === 'A' ? 'justify-start' : 'justify-end'} mb-4`}>
                    <div className={`relative max-w-lg px-6 py-4 rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-md ${
                      segment.speakerId === 'A' 
                        ? 'bg-white text-gray-800 rounded-bl-md border-gray-200' 
                        : 'bg-blue-500 text-white rounded-br-md ml-auto border-blue-400'
                    }`}>
                      {/* Speaker label */}
                      <div className={`text-xs font-bold mb-2 flex items-center space-x-2 ${
                        segment.speakerId === 'A' ? 'text-gray-500' : 'text-blue-100'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          segment.speakerId === 'A' ? 'bg-green-500' : 'bg-blue-200'
                        }`}></div>
                        <span>Speaker {segment.speakerId}</span>
                      </div>
                      
                      {/* Message content */}
                      <p className="text-sm leading-relaxed">
                        {segment.text}
                      </p>
                      
                      {/* Chat bubble tail */}
                      <div className={`absolute top-3 w-3 h-3 ${
                        segment.speakerId === 'A' 
                          ? '-left-1.5 bg-white border-l border-b border-gray-200 transform rotate-45' 
                          : '-right-1.5 bg-blue-500 transform rotate-45'
                      }`}></div>
                    </div>
                  </div>
                ))}
                
                {/* Empty state */}
                {transcription.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <p className="text-lg font-medium">No transcription segments available</p>
                    <p className="text-sm">Try recording some audio first</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 flex gap-4 justify-center">
                <button
                  onClick={() => navigator.clipboard.writeText(transcription.map(s => `Speaker ${s.speakerId}: ${s.text}`).join('\n\n'))}
                  className="group bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 flex items-center space-x-3"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                  <span>Copy Transcript</span>
                </button>
                <button
                  onClick={() => setShowTranscription(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg"
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
