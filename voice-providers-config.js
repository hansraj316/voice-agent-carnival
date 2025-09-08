/**
 * Comprehensive Voice API Providers Configuration
 * Open Router-style configuration for voice agents with BYOK support
 */

export const VOICE_PROVIDERS = {
  // Real-time Speech-to-Speech Providers
  'openai-realtime': {
    name: 'OpenAI Realtime API',
    type: 'realtime',
    capabilities: ['speech-to-speech', 'real-time', 'function-calling'],
    latency: '~500ms',
    pricing: '$0.06/min input, $0.24/min output',
    models: ['gpt-4o-realtime-preview-2024-12-17'],
    auth: 'bearer',
    endpoint: 'wss://api.openai.com/v1/realtime',
    features: {
      streaming: true,
      interruption: true,
      emotions: false,
      customVoices: false,
      languages: ['en']
    }
  },

  // Speech-to-Text Providers
  'deepgram': {
    name: 'Deepgram Nova-3',
    type: 'stt',
    capabilities: ['speech-to-text', 'real-time', 'pre-recorded'],
    latency: '<300ms',
    pricing: '$0.0043/min pre-recorded, $0.0077/min streaming',
    models: ['nova-3', 'nova-2', 'whisper'],
    auth: 'token',
    endpoint: 'wss://api.deepgram.com/v1/listen',
    features: {
      streaming: true,
      punctuation: true,
      profanityFilter: true,
      languageDetection: true,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'hi', 'ja', 'ko', 'zh', 'ru', 'ar']
    }
  },

  'assemblyai': {
    name: 'AssemblyAI Universal-2',
    type: 'stt',
    capabilities: ['speech-to-text', 'real-time', 'pre-recorded'],
    latency: '~400ms',
    pricing: '$0.37/hour async, $0.47/hour real-time',
    models: ['universal-2', 'universal-1'],
    auth: 'token',
    endpoint: 'wss://api.assemblyai.com/v2/realtime/ws',
    features: {
      streaming: true,
      speakerLabels: true,
      sentimentAnalysis: true,
      topicDetection: true,
      languages: ['en']
    }
  },

  'whisper': {
    name: 'OpenAI Whisper',
    type: 'stt',
    capabilities: ['speech-to-text', 'pre-recorded'],
    latency: '~1-3s',
    pricing: '$0.006/minute',
    models: ['whisper-1'],
    auth: 'bearer',
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    features: {
      streaming: false,
      translation: true,
      timestamped: true,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'hi', 'ja', 'ko', 'zh', 'ru', 'ar', 'many_more']
    }
  },

  'google-stt': {
    name: 'Google Cloud Speech-to-Text',
    type: 'stt',
    capabilities: ['speech-to-text', 'real-time', 'pre-recorded'],
    latency: '~500ms',
    pricing: 'Variable by region and usage',
    models: ['latest', 'command_and_search', 'phone_call', 'video'],
    auth: 'service-account',
    endpoint: 'wss://speech.googleapis.com/v1/speech:streamingrecognize',
    features: {
      streaming: true,
      adaptation: true,
      profanityFilter: true,
      languageDetection: true,
      languages: ['125+ languages and variants']
    }
  },

  'azure-stt': {
    name: 'Microsoft Azure Speech Services',
    type: 'stt',
    capabilities: ['speech-to-text', 'real-time', 'pre-recorded'],
    latency: '~400ms',
    pricing: 'Variable by region and usage',
    models: ['unified', 'conversation', 'dictation'],
    auth: 'subscription-key',
    endpoint: 'wss://{{region}}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1',
    features: {
      streaming: true,
      customModels: true,
      profanityFilter: true,
      translation: true,
      languages: ['100+ languages']
    }
  },

  // Text-to-Speech Providers
  'elevenlabs': {
    name: 'ElevenLabs TTS',
    type: 'tts',
    capabilities: ['text-to-speech', 'voice-cloning', 'real-time'],
    latency: '<300ms with Turbo',
    pricing: '$0.30/1k chars (Creator), $0.24/1k chars (Pro)',
    models: ['multilingual-v2', 'turbo-v2', 'eleven_english_v1'],
    auth: 'xi-api-key',
    endpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
    features: {
      streaming: true,
      voiceCloning: true,
      emotions: true,
      customVoices: true,
      languages: ['142 languages and accents']
    }
  },

  'playht': {
    name: 'PlayHT',
    type: 'tts',
    capabilities: ['text-to-speech', 'real-time', 'voice-cloning'],
    latency: '<300ms',
    pricing: 'Usage-based pricing',
    models: ['PlayHT2.0-turbo', 'PlayHT2.0', 'PlayHT1.0'],
    auth: 'x-api-key',
    endpoint: 'https://api.play.ht/api/v2/tts',
    features: {
      streaming: true,
      voiceCloning: true,
      emotions: true,
      customVoices: true,
      languages: ['142 languages']
    }
  },

  'google-tts': {
    name: 'Google Cloud Text-to-Speech',
    type: 'tts',
    capabilities: ['text-to-speech', 'neural-voices'],
    latency: '~500ms',
    pricing: 'Variable by voice type',
    models: ['standard', 'wavenet', 'neural2', 'polyglot'],
    auth: 'service-account',
    endpoint: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    features: {
      streaming: false,
      customVoices: true,
      ssml: true,
      audioProfiles: true,
      languages: ['220+ voices in 40+ languages']
    }
  },

  'azure-tts': {
    name: 'Microsoft Azure Text-to-Speech',
    type: 'tts',
    capabilities: ['text-to-speech', 'neural-voices', 'custom-voices'],
    latency: '~400ms',
    pricing: 'Variable by voice type',
    models: ['neural', 'standard'],
    auth: 'subscription-key',
    endpoint: 'https://{{region}}.tts.speech.microsoft.com/cognitiveservices/v1',
    features: {
      streaming: true,
      customVoices: true,
      ssml: true,
      emotions: true,
      languages: ['400+ voices in 140+ languages']
    }
  },

  'amazon-polly': {
    name: 'Amazon Polly',
    type: 'tts',
    capabilities: ['text-to-speech', 'neural-voices'],
    latency: '~600ms',
    pricing: '$4.00 per 1M characters (Neural)',
    models: ['standard', 'neural', 'long-form'],
    auth: 'aws-signature',
    endpoint: 'https://polly.{{region}}.amazonaws.com/v1/speech',
    features: {
      streaming: true,
      lexicons: true,
      ssml: true,
      speechmarks: true,
      languages: ['60+ voices in 30+ languages']
    }
  },

  'murf': {
    name: 'Murf AI',
    type: 'tts',
    capabilities: ['text-to-speech', 'voice-customization'],
    latency: '~800ms',
    pricing: 'Subscription-based',
    models: ['murf-ai'],
    auth: 'api-key',
    endpoint: 'https://api.murf.ai/v1/speech/generate',
    features: {
      streaming: false,
      customization: true,
      emotions: true,
      brandVoices: true,
      languages: ['120+ voices in 20+ languages']
    }
  },

  // Hybrid/Conversational AI Providers
  'elevenlabs-conversational': {
    name: 'ElevenLabs Conversational AI',
    type: 'conversational',
    capabilities: ['speech-to-speech', 'conversation', 'interruption'],
    latency: '<800ms',
    pricing: 'Per-minute conversation pricing',
    models: ['conversational-v1'],
    auth: 'xi-api-key',
    endpoint: 'wss://api.elevenlabs.io/v1/convai/conversation',
    features: {
      streaming: true,
      interruption: true,
      emotions: true,
      customVoices: true,
      languages: ['Multiple languages']
    }
  },

  // Cloud Providers with Comprehensive Services
  'ibm-watson': {
    name: 'IBM Watson Speech',
    type: 'hybrid',
    capabilities: ['speech-to-text', 'text-to-speech', 'custom-models'],
    latency: '~500ms',
    pricing: 'Usage-based',
    models: ['watson-stt', 'watson-tts'],
    auth: 'iam-token',
    endpoint: 'https://api.us-south.speech-to-text.watson.cloud.ibm.com',
    features: {
      streaming: true,
      customModels: true,
      domainAdaptation: true,
      speakerLabels: true,
      languages: ['Multiple languages with domain specialization']
    }
  }
};

export const PROVIDER_CATEGORIES = {
  'Real-time Speech-to-Speech': ['openai-realtime', 'elevenlabs-conversational'],
  'Speech-to-Text': ['deepgram', 'assemblyai', 'whisper', 'google-stt', 'azure-stt'],
  'Text-to-Speech': ['elevenlabs', 'playht', 'google-tts', 'azure-tts', 'amazon-polly', 'murf'],
  'Enterprise/Hybrid': ['ibm-watson', 'azure-stt', 'google-stt']
};

export const PRICING_MODELS = {
  'per-minute': ['openai-realtime', 'deepgram', 'whisper'],
  'per-hour': ['assemblyai'],
  'per-character': ['elevenlabs', 'playht', 'amazon-polly'],
  'subscription': ['murf'],
  'usage-based': ['google-stt', 'google-tts', 'azure-stt', 'azure-tts', 'ibm-watson']
};