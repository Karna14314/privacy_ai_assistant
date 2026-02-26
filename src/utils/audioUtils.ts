export interface AudioFormatOptions {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}
export async function checkMicrophoneAccess(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('❌ getUserMedia not supported in this browser');
      return false;
    }
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log(' Microphone permission status:', permission.state);
        if (permission.state === 'denied') {
          console.error('❌ Microphone access denied by user');
          return false;
        }
      } catch (permError) {
        console.warn('⚠️ Could not check microphone permissions:', permError);
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) {
      console.error('❌ No audio tracks available');
      return false;
    }
    tracks.forEach(track => track.stop());
    console.log('✅ Microphone access verified');
    return true;
  } catch (error) {
    console.error('❌ Microphone access check failed:', error);
    return false;
  }
}
export function getOptimalAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      sampleRate: { ideal: 16000, min: 8000, max: 48000 },
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  };
}
export async function convertToPCM(audioBlob: Blob): Promise<ArrayBuffer> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const audioData = audioBuffer.getChannelData(0);
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32767));
    }
    audioContext.close();
    return pcmData.buffer;
  } catch (error) {
    console.error('❌ Audio conversion failed:', error);
    throw new Error(`Audio conversion failed: ${error}`);
  }
}
export function createOptimalMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ];
  let selectedMimeType = '';
  let recordingOptions: MediaRecorderOptions = {};
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      selectedMimeType = mimeType;
      recordingOptions = { mimeType };
      break;
    }
  }
  console.log(' Using audio format:', selectedMimeType || 'browser default');
  try {
    return new MediaRecorder(stream, recordingOptions);
  } catch (error) {
    console.warn('⚠️ Failed to create MediaRecorder with preferred options, using defaults:', error);
    return new MediaRecorder(stream);
  }
}
export class StreamingAudioProcessor {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private onAudioData: ((data: Float32Array) => void) | null = null;
  constructor(onAudioData: (data: Float32Array) => void) {
    this.onAudioData = onAudioData;
  }
  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(getOptimalAudioConstraints());
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        if (this.onAudioData) {
          this.onAudioData(inputData);
        }
      };
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      console.log('✅ Streaming audio processor started');
    } catch (error) {
      console.error('❌ Failed to start streaming audio processor:', error);
      throw error;
    }
  }
  stop(): void {
    try {
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      console.log('✅ Streaming audio processor stopped');
    } catch (error) {
      console.error('❌ Error stopping streaming audio processor:', error);
    }
  }
}
export function createAudioChunks(audioData: Float32Array, chunkSize: number = 1024): Float32Array[] {
  const chunks: Float32Array[] = [];
  for (let i = 0; i < audioData.length; i += chunkSize) {
    const chunk = audioData.slice(i, i + chunkSize);
    chunks.push(chunk);
  }
  return chunks;
}
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32767));
  }
  return int16Array;
}
export class StreamingTTS {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private textQueue: string[] = [];
  private isPlaying: boolean = false;
  constructor() {
    this.synth = window.speechSynthesis;
  }
  speakStreaming(text: string): void {
    const chunks = text.split(/[.!?]+/).filter(chunk => chunk.trim().length > 0);
    chunks.forEach(chunk => {
      this.textQueue.push(chunk.trim());
    });
    if (!this.isPlaying) {
      this.playNext();
    }
  }
  private playNext(): void {
    if (this.textQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;
    const text = this.textQueue.shift()!;
    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.onend = () => {
      this.playNext();
    };
    this.currentUtterance.onerror = (error) => {
      console.error('❌ TTS error:', error);
      this.playNext();
    };
    this.synth.speak(this.currentUtterance);
  }
  stop(): void {
    this.synth.cancel();
    this.textQueue = [];
    this.isPlaying = false;
    this.currentUtterance = null;
  }
  pause(): void {
    this.synth.pause();
  }
  resume(): void {
    this.synth.resume();
  }
}
