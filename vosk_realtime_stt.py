"""
 Vosk Real-time Speech-to-Text with Proper Microphone Capture
Fixes common issues with live mic input for offline AI assistants.
Requirements:
- pip install vosk sounddevice numpy wave
- Download Vosk model: https://alphacephei.com/vosk/models
"""
import json
import queue
import sys
import threading
import time
import wave
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List
import numpy as np
import sounddevice as sd
import vosk
SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = np.int16
CHUNK_SIZE = 4000
BLOCKSIZE = 2000
VOSK_MODEL_PATH = "vosk-model-small-en-us-0.15"
DEBUG_AUDIO_DIR = Path("debug_audio")
DEBUG_AUDIO_DIR.mkdir(exist_ok=True)
class VoskRealtimeSTT:
    """Real-time Speech-to-Text using Vosk with proper microphone handling."""
    def __init__(self, model_path: str = VOSK_MODEL_PATH):
        """Initialize Vosk STT with proper configuration."""
        print(f" Initializing Vosk STT...")
        print(f" Model path: {model_path}")
        if not Path(model_path).exists():
            raise FileNotFoundError(f"❌ Vosk model not found: {model_path}")
        vosk.SetLogLevel(-1)
        self.model = vosk.Model(model_path)
        self.recognizer = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.debug_audio_data = []
        print("✅ Vosk STT initialized successfully")
    def list_audio_devices(self) -> List[Dict]:
        """List all available audio input devices."""
        print("\n Available Audio Input Devices:")
        devices = []
        device_list = sd.query_devices()
        for i, device in enumerate(device_list):
            if device['max_input_channels'] > 0:
                devices.append({
                    'id': i,
                    'name': device['name'],
                    'channels': device['max_input_channels'],
                    'sample_rate': device['default_samplerate']
                })
                print(f"  {i}: {device['name']} ({device['max_input_channels']} ch, {device['default_samplerate']} Hz)")
        return devices
    def select_microphone(self) -> Optional[int]:
        """Interactive microphone selection."""
        devices = self.list_audio_devices()
        if not devices:
            print("❌ No input devices found!")
            return None
        try:
            default_device = sd.query_devices(kind='input')
            default_id = default_device['index'] if 'index' in default_device else 0
            print(f"\n Using default input device: {default_id}")
            return default_id
        except Exception as e:
            print(f"⚠️ Could not get default device: {e}")
            return devices[0]['id']
    def audio_callback(self, indata, frames, time, status):
        """Callback for audio input - processes each audio chunk."""
        if status:
            print(f"⚠️ Audio callback status: {status}")
        audio_data = indata[:, 0] if indata.shape[1] > 1 else indata.flatten()
        audio_int16 = (audio_data * 32767).astype(np.int16)
        if self.is_recording:
            self.debug_audio_data.extend(audio_int16)
        self.audio_queue.put(audio_int16.tobytes())
    def save_debug_audio(self, filename: str = None):
        """Save captured audio to WAV file for debugging."""
        if not self.debug_audio_data:
            print("⚠️ No audio data to save")
            return
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"debug_mic_capture_{timestamp}.wav"
        filepath = DEBUG_AUDIO_DIR / filename
        audio_array = np.array(self.debug_audio_data, dtype=np.int16)
        with wave.open(str(filepath), 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_array.tobytes())
        duration = len(audio_array) / SAMPLE_RATE
        print(f" Debug audio saved: {filepath} ({duration:.1f}s, {len(audio_array)} samples)")
        return filepath
    def process_audio_stream(self):
        """Process audio chunks from the queue with Vosk."""
        print(" Starting audio processing thread...")
        while self.is_recording:
            try:
                audio_chunk = self.audio_queue.get(timeout=0.1)
                if self.recognizer.AcceptWaveform(audio_chunk):
                    result = json.loads(self.recognizer.Result())
                    if result.get('text', '').strip():
                        print(f" FINAL: {result['text']}")
                else:
                    partial = json.loads(self.recognizer.PartialResult())
                    if partial.get('partial', '').strip():
                        print(f" PARTIAL: {partial['partial']}", end='\r')
            except queue.Empty:
                continue
            except Exception as e:
                print(f"❌ Audio processing error: {e}")
    def start_recording(self, duration: float = 10.0, device_id: Optional[int] = None):
        """Start real-time recording and transcription."""
        if device_id is None:
            device_id = self.select_microphone()
        if device_id is None:
            print("❌ No microphone selected")
            return
        print(f"\n Starting recording...")
        print(f" Config: {SAMPLE_RATE}Hz, {CHANNELS} channel, {DTYPE}, device {device_id}")
        print(f"⏱️ Duration: {duration}s")
        print(" Recording... (speak now)")
        self.is_recording = True
        self.debug_audio_data = []
        processing_thread = threading.Thread(target=self.process_audio_stream)
        processing_thread.daemon = True
        processing_thread.start()
        try:
            with sd.InputStream(
                device=device_id,
                channels=CHANNELS,
                samplerate=SAMPLE_RATE,
                dtype='float32',
                blocksize=BLOCKSIZE,
                callback=self.audio_callback
            ):
                time.sleep(duration)
        except Exception as e:
            print(f"❌ Recording error: {e}")
        finally:
            print(f"\n⏹️ Recording stopped")
            self.is_recording = False
            final_result = json.loads(self.recognizer.FinalResult())
            if final_result.get('text', '').strip():
                print(f" FINAL RESULT: {final_result['text']}")
            else:
                print("❌ No transcript found")
            self.save_debug_audio()
    def test_microphone(self, duration: float = 5.0):
        """Test microphone capture without transcription."""
        device_id = self.select_microphone()
        if device_id is None:
            return
        print(f"\n Testing microphone for {duration}s...")
        audio_data = []
        def test_callback(indata, frames, time, status):
            if status:
                print(f"Status: {status}")
            audio_data.extend((indata[:, 0] * 32767).astype(np.int16))
        try:
            with sd.InputStream(
                device=device_id,
                channels=CHANNELS,
                samplerate=SAMPLE_RATE,
                dtype='float32',
                callback=test_callback
            ):
                time.sleep(duration)
            if audio_data:
                audio_array = np.array(audio_data)
                rms = np.sqrt(np.mean(audio_array**2))
                max_val = np.max(np.abs(audio_array))
                print(f" Audio Analysis:")
                print(f"   Samples: {len(audio_array)}")
                print(f"   Duration: {len(audio_array)/SAMPLE_RATE:.1f}s")
                print(f"   RMS Level: {rms:.1f}")
                print(f"   Max Level: {max_val}")
                print(f"   Dynamic Range: {'Good' if max_val > 1000 else 'Low - speak louder!'}")
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                test_file = DEBUG_AUDIO_DIR / f"mic_test_{timestamp}.wav"
                with wave.open(str(test_file), 'wb') as wf:
                    wf.setnchannels(CHANNELS)
                    wf.setsampwidth(2)
                    wf.setframerate(SAMPLE_RATE)
                    wf.writeframes(audio_array.tobytes())
                print(f" Test audio saved: {test_file}")
            else:
                print("❌ No audio captured!")
        except Exception as e:
            print(f"❌ Microphone test failed: {e}")
def main():
    """Main function with interactive menu."""
    print(" Vosk Real-time STT - Microphone Capture Fix")
    print("=" * 50)
    try:
        stt = VoskRealtimeSTT()
    except FileNotFoundError as e:
        print(f"❌ {e}")
        print(" Download a Vosk model from: https://alphacephei.com/vosk/models")
        return
    except Exception as e:
        print(f"❌ Initialization failed: {e}")
        return
    while True:
        print("\n Choose an option:")
        print("1.  Start real-time STT (10s)")
        print("2.  Test microphone capture (5s)")
        print("3.  List audio devices")
        print("4. ⚙️ Custom duration STT")
        print("5.  Exit")
        choice = input("\nEnter choice (1-5): ").strip()
        if choice == '1':
            stt.start_recording(duration=10.0)
        elif choice == '2':
            stt.test_microphone(duration=5.0)
        elif choice == '3':
            stt.list_audio_devices()
        elif choice == '4':
            try:
                duration = float(input("Enter duration in seconds: "))
                stt.start_recording(duration=duration)
            except ValueError:
                print("❌ Invalid duration")
        elif choice == '5':
            print(" Goodbye!")
            break
        else:
            print("❌ Invalid choice")
if __name__ == "__main__":
    main()
