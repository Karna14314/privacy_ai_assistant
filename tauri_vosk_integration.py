"""
 Tauri Integration Example for Vosk Real-time STT
Shows how to integrate the Vosk STT with your Tauri AI assistant.
"""
import json
import sys
import threading
import time
from pathlib import Path
from typing import Optional, Callable
import numpy as np
import sounddevice as sd
import vosk
class TauriVoskSTT:
    """Simplified Vosk STT for Tauri integration."""
    def __init__(self, model_path: str, callback: Optional[Callable] = None):
        """
        Initialize Vosk STT for Tauri integration.
        Args:
            model_path: Path to Vosk model directory
            callback: Function to call with transcription results
        """
        self.callback = callback
        self.sample_rate = 16000
        self.channels = 1
        self.blocksize = 2000
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Vosk model not found: {model_path}")
        vosk.SetLogLevel(-1)
        self.model = vosk.Model(model_path)
        self.recognizer = vosk.KaldiRecognizer(self.model, self.sample_rate)
        self.is_recording = False
        self.audio_buffer = []
    def audio_callback(self, indata, frames, time, status):
        """Process audio input."""
        if not self.is_recording:
            return
        if status:
            print(f"Audio status: {status}", file=sys.stderr)
        audio_data = indata[:, 0] if indata.shape[1] > 1 else indata.flatten()
        audio_int16 = (audio_data * 32767).astype(np.int16)
        if self.recognizer.AcceptWaveform(audio_int16.tobytes()):
            result = json.loads(self.recognizer.Result())
            if result.get('text', '').strip():
                self._handle_result('final', result['text'])
        else:
            partial = json.loads(self.recognizer.PartialResult())
            if partial.get('partial', '').strip():
                self._handle_result('partial', partial['partial'])
    def _handle_result(self, result_type: str, text: str):
        """Handle transcription results."""
        if self.callback:
            self.callback(result_type, text)
        else:
            result = {
                'type': result_type,
                'text': text,
                'timestamp': time.time()
            }
            print(json.dumps(result), flush=True)
    def start_recording(self, duration: Optional[float] = None):
        """Start recording with optional duration limit."""
        if self.is_recording:
            return False
        self.is_recording = True
        try:
            with sd.InputStream(
                channels=self.channels,
                samplerate=self.sample_rate,
                dtype='float32',
                blocksize=self.blocksize,
                callback=self.audio_callback
            ):
                if duration:
                    time.sleep(duration)
                    self.stop_recording()
                else:
                    while self.is_recording:
                        time.sleep(0.1)
        except Exception as e:
            self._handle_result('error', str(e))
            return False
        return True
    def stop_recording(self):
        """Stop recording and get final result."""
        if not self.is_recording:
            return
        self.is_recording = False
        final_result = json.loads(self.recognizer.FinalResult())
        if final_result.get('text', '').strip():
            self._handle_result('final', final_result['text'])
    def transcribe_duration(self, duration: float = 5.0) -> str:
        """Record for a specific duration and return transcript."""
        transcript = ""
        def capture_result(result_type, text):
            nonlocal transcript
            if result_type == 'final':
                transcript = text
        original_callback = self.callback
        self.callback = capture_result
        try:
            self.start_recording(duration)
            return transcript
        finally:
            self.callback = original_callback
def main():
    """Main function for command-line usage."""
    if len(sys.argv) < 2:
        print("Usage: python tauri_vosk_integration.py <model_path> [duration]")
        print("Example: python tauri_vosk_integration.py vosk-model-en-us-0.22 5.0")
        sys.exit(1)
    model_path = sys.argv[1] if len(sys.argv) > 1 else "vosk-model-small-en-us-0.15"
    duration = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
    try:
        stt = TauriVoskSTT(model_path)
        print(f"Recording for {duration} seconds...", file=sys.stderr)
        transcript = stt.transcribe_duration(duration)
        if transcript:
            result = {
                'success': True,
                'transcript': transcript,
                'duration': duration
            }
        else:
            result = {
                'success': False,
                'error': 'No speech detected',
                'duration': duration
            }
        print(json.dumps(result))
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'duration': 0
        }
        print(json.dumps(error_result))
        sys.exit(1)
def example_tauri_integration():
    """Example of how to integrate with Tauri Rust backend."""
    def rust_stt_command(model_path: str, duration: float = 5.0) -> dict:
        """
        Function that your Rust backend would call.
        Returns JSON result that Rust can parse.
        """
        try:
            stt = TauriVoskSTT(model_path)
            transcript = stt.transcribe_duration(duration)
            return {
                'success': True,
                'transcript': transcript,
                'confidence': 1.0,
                'duration': duration
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'transcript': '',
                'duration': 0
            }
    """
    // In your Rust code (src-tauri/src/stt_tts.rs):
    use std::process::Command;
    use serde_json::Value;
    #[tauri::command]
    pub async fn vosk_transcribe(duration: f64) -> Result<String, String> {
        let output = Command::new("python")
            .arg("tauri_vosk_integration.py")
            .arg("vosk-model-en-us-0.22")
            .arg(duration.to_string())
            .output()
            .map_err(|e| format!("Failed to run STT: {}", e))?;
        if output.status.success() {
            let result: Value = serde_json::from_slice(&output.stdout)
                .map_err(|e| format!("Failed to parse STT result: {}", e))?;
            if result["success"].as_bool().unwrap_or(false) {
                Ok(result["transcript"].as_str().unwrap_or("").to_string())
            } else {
                Err(result["error"].as_str().unwrap_or("STT failed").to_string())
            }
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
    """
if __name__ == "__main__":
    main()
