import wave
import json
import os
import io
from vosk import Model, KaldiRecognizer
from pydub import AudioSegment
class STT:
    def __init__(self, model_path):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model path not found: {model_path}")
        self.model = Model(model_path)
    def transcribe(self, audio_path):
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        try:
            processed_audio_path = self.preprocess_audio(audio_path)
        except Exception as e:
            return {"success": False, "error": f"Failed to preprocess audio: {e}"}
        try:
            with wave.open(processed_audio_path, "rb") as wf:
                if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
                    return {"success": False, "error": "Audio file must be WAV format, 16kHz, 16-bit, mono."}
                recognizer = KaldiRecognizer(self.model, wf.getframerate())
                while True:
                    data = wf.readframes(4000)
                    if len(data) == 0:
                        break
                    if recognizer.AcceptWaveform(data):
                        pass
                result = json.loads(recognizer.FinalResult())
                return {"success": True, "text": result["text"]}
        except Exception as e:
            return {"success": False, "error": f"Transcription failed: {e}"}
    def preprocess_audio(self, audio_path):
        try:
            audio = AudioSegment.from_file(audio_path)
            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(16000)
            audio = audio.set_sample_width(2)
            processed_path = os.path.join(os.path.dirname(audio_path), "processed_audio.wav")
            audio.export(processed_path, format="wav")
            return processed_path
        except Exception as e:
            raise e
    def transcribe_filelike(self, fileobj):
        """Transcribe audio from a file-like object (BytesIO)"""
        try:
            with wave.open(fileobj, "rb") as wf:
                if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
                    return {"success": False, "error": "Audio file must be WAV format, 16kHz, 16-bit, mono."}
                recognizer = KaldiRecognizer(self.model, wf.getframerate())
                while True:
                    data = wf.readframes(4000)
                    if len(data) == 0:
                        break
                    if recognizer.AcceptWaveform(data):
                        pass
                result = json.loads(recognizer.FinalResult())
                return {"success": True, "text": result["text"]}
        except Exception as e:
            return {"success": False, "error": f"Transcription failed: {e}"}
