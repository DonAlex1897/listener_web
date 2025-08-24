# Voice Transcription Frontend

A Next.js frontend for real-time voice transcription using a .NET API.

## Features

- Real-time audio recording with 30-second buffer
- Start/Stop/Transcribe controls
- Clean, minimal UI with Tailwind CSS
- Integration with VoiceTranscriptionAPI

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Click "Start Listening" to begin recording
2. The app will continuously record and keep the latest 30 seconds in memory
3. Use "Stop" to pause recording while keeping the audio buffer
4. Use "Transcribe" to send the latest 30 seconds to the API for transcription

## Requirements

- Modern browser with microphone access
- VoiceTranscriptionAPI running on localhost:7106
- HTTPS connection for microphone permissions

## API Integration

The frontend sends audio files to:
- `POST /api/transcription/transcribe`

Make sure the backend API is running and CORS is configured properly.
