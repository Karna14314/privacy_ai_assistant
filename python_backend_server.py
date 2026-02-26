"""
 Python Backend Server for Privacy AI Assistant
Handles real-time STT streaming and LLM communication.
Architecture:
- FastAPI server for HTTP endpoints
- WebSocket for real-time STT streaming
- Vosk for offline speech recognition
- Ollama client for LLM communication
Requirements:
- pip install fastapi uvicorn websockets vosk sounddevice numpy requests
"""
import asyncio
import json
import logging
import queue
import threading
import time
import wave
from pathlib import Path
from typing import Optional, Dict, Any, List
import base64
import io
import numpy as np
import sounddevice as sd
import vosk
import requests
import os
import base64
import tempfile
import logging
import traceback
from datetime import datetime
from pydub import AudioSegment
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
from stt.stt import STT
from chat_sessions import (
    session_manager,
    ChatSession,
    ChatMessage,
    ChatSessionSummary,
    CreateChatRequest,
    CreateChatResponse,
    RenameChatRequest,
    AddMessageRequest,
    ChatListResponse,
    ChatSessionResponse
)
from hardware_detection import (
    get_runtime_config,
    get_hardware_summary,
    hardware_detector,
    RuntimeConfig,
    HardwareInfo
)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('backend.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)
SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = np.int16
CHUNK_SIZE = 4000
BLOCKSIZE = 2000
VOSK_MODEL_PATH = "vosk-model-small-en-us-0.15"
DEBUG_AUDIO_DIR = Path("debug_audio")
DEBUG_AUDIO_DIR.mkdir(exist_ok=True)
OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "gemma3n:latest"
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from contextlib import asynccontextmanager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    logger.info(" Starting Privacy AI Assistant Backend...")
    if not initialize_vosk():
        logger.error("❌ Failed to initialize Vosk - STT will not work")
    ollama_status = {"connected": False, "error": None, "models": [], "default_model_available": False}
    try:
        logger.info(" Testing Ollama connection...")
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if response.status_code == 200:
            models = response.json().get('models', [])
            model_names = [model['name'] for model in models]
            ollama_status["connected"] = True
            ollama_status["models"] = model_names
            logger.info(f"✅ Ollama connected. Available models: {model_names}")
            if any(DEFAULT_MODEL in name for name in model_names):
                ollama_status["default_model_available"] = True
                logger.info(f"✅ Default model {DEFAULT_MODEL} is available")
            else:
                logger.warning(f"⚠️ Default model {DEFAULT_MODEL} not found. Available: {model_names}")
        else:
            ollama_status["error"] = f"API returned status {response.status_code}"
            logger.warning(f"⚠️ Ollama API returned status {response.status_code} - continuing startup")
    except requests.exceptions.Timeout:
        ollama_status["error"] = "Connection timeout"
        logger.warning("⚠️ Ollama connection timeout - continuing startup without Ollama")
    except requests.exceptions.ConnectionError:
        ollama_status["error"] = "Connection refused"
        logger.warning("⚠️ Ollama connection refused - continuing startup without Ollama")
    except Exception as e:
        ollama_status["error"] = str(e)
        logger.warning(f"⚠️ Failed to connect to Ollama: {e} - continuing startup")
    app.state.ollama_status = ollama_status
    logger.info(" Backend startup completed - ready to serve requests")
    yield
    logger.info(" Shutting down Privacy AI Assistant Backend...")
app = FastAPI(title="Privacy AI Assistant Backend", version="1.0.0", lifespan=lifespan)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    error_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    logger.error(f" Unhandled exception [{error_id}]: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "error_id": error_id,
            "message": "An unexpected error occurred. Please check the server logs."
        }
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "tauri://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class STTRequest(BaseModel):
    audio_data: str
    format: str = "webm"
    sample_rate: Optional[int] = 16000
    channels: Optional[int] = 1
class STTResponse(BaseModel):
    text: str
    success: bool
    error: Optional[str] = None
class LLMRequest(BaseModel):
    prompt: str
    model: str = DEFAULT_MODEL
    stream: bool = False
class LLMResponse(BaseModel):
    response: str
    model: str
    success: bool
    error: Optional[str] = None
stt_processor: Optional[STT] = None
def initialize_vosk():
    """Initialize Vosk model and recognizer."""
    global stt_processor
    try:
        model_path = Path("models/vosk/vosk-model-en-us-0.22-lgraph")
        if not model_path.exists():
            logger.error(f"❌ Vosk model not found: {model_path}")
            return False
        logger.info(f" Initializing Vosk model: {model_path}")
        vosk.SetLogLevel(-1)
        stt_processor = STT(str(model_path))
        logger.info(" Testing Vosk model initialization...")
        test_result = stt_processor.model
        if test_result:
            logger.info("✅ Vosk model loaded and tested successfully")
        logger.info("✅ Vosk initialized successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to initialize Vosk: {e}")
        return False
class RealtimeSTT:
    """Real-time STT processor for WebSocket streaming."""
    def __init__(self):
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.recognizer = None
        self.websocket = None
        self.debug_audio_data = []
        self.loop = None
    def start_recording(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop):
        """Start real-time recording and processing."""
        global stt_processor
        if not stt_processor:
            logger.error("Vosk STT processor not initialized, cannot start real-time STT.")
            return
        self.websocket = websocket
        self.loop = loop
        self.is_recording = True
        self.recognizer = vosk.KaldiRecognizer(stt_processor.model, SAMPLE_RATE)
        self.debug_audio_data = []
        self.audio_thread = threading.Thread(target=self._audio_capture_thread)
        self.audio_thread.start()
        self.processing_thread = threading.Thread(target=self._process_audio_stream)
        self.processing_thread.start()
        logger.info(" Started real-time STT recording")
    def stop_recording(self):
        """Stop recording and processing."""
        self.is_recording = False
        if hasattr(self, 'audio_thread'):
            self.audio_thread.join(timeout=2)
        if hasattr(self, 'processing_thread'):
            self.processing_thread.join(timeout=2)
        if self.debug_audio_data:
            self._save_debug_audio()
        logger.info("⏹️ Stopped real-time STT recording")
    def _audio_capture_thread(self):
        """Capture audio from microphone."""
        def audio_callback(indata, frames, time, status):
            if not self.is_recording:
                return
            if status:
                logger.warning(f"Audio status: {status}")
            audio_data = indata[:, 0] if indata.shape[1] > 1 else indata.flatten()
            audio_int16 = (audio_data * 32767).astype(np.int16)
            self.audio_queue.put(audio_int16.tobytes())
            self.debug_audio_data.extend(audio_int16)
        try:
            with sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                dtype=np.float32,
                blocksize=BLOCKSIZE,
                callback=audio_callback
            ):
                while self.is_recording:
                    time.sleep(0.1)
        except Exception as e:
            logger.error(f"❌ Audio capture error: {e}")
    def _process_audio_stream(self):
        """Process audio chunks with Vosk."""
        while self.is_recording:
            try:
                audio_chunk = self.audio_queue.get(timeout=0.1)
                if self.recognizer.AcceptWaveform(audio_chunk):
                    result = json.loads(self.recognizer.Result())
                    if result.get('text', '').strip():
                        self._send_result_threadsafe('final', result['text'])
                else:
                    partial = json.loads(self.recognizer.PartialResult())
                    if partial.get('partial', '').strip():
                        self._send_result_threadsafe('partial', partial['partial'])
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"❌ Processing error: {e}")
    def _send_result_threadsafe(self, result_type: str, text: str):
        """Send result to WebSocket client in a thread-safe manner."""
        if self.loop and self.websocket:
            future = asyncio.run_coroutine_threadsafe(
                self._send_result(result_type, text),
                self.loop
            )
            try:
                future.result(timeout=2)
            except Exception as e:
                logger.error(f"❌ Error sending WebSocket message from thread: {e}")
    async def _send_result(self, result_type: str, text: str):
        """Send result to WebSocket client."""
        if self.websocket:
            try:
                await self.websocket.send_json({
                    'type': result_type,
                    'text': text,
                    'timestamp': time.time()
                })
                logger.info(f" Sent {result_type}: {text}")
            except Exception as e:
                logger.error(f"❌ Failed to send WebSocket message: {e}")
    def _save_debug_audio(self):
        """Save captured audio for debugging."""
        if not self.debug_audio_data:
            return
        timestamp = int(time.time())
        debug_file = DEBUG_AUDIO_DIR / f"debug_audio_{timestamp}.wav"
        try:
            with wave.open(str(debug_file), 'wb') as wf:
                wf.setnchannels(CHANNELS)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(np.array(self.debug_audio_data, dtype=np.int16).tobytes())
            logger.info(f" Saved debug audio: {debug_file}")
        except Exception as e:
            logger.error(f"❌ Failed to save debug audio: {e}")
realtime_stt = RealtimeSTT()
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "vosk_initialized": stt_processor is not None,
        "timestamp": time.time()
    }
@app.get("/ollama/models")
async def get_ollama_models():
    """Get available Ollama models."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ollama API error")
    except requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Cannot connect to Ollama: {e}")
@app.post("/stt/transcribe", response_model=STTResponse)
async def transcribe_audio_file(request: STTRequest):
    """Transcribe an audio file using Vosk."""
    if not stt_processor:
        logger.error("Vosk STT processor not initialized, cannot transcribe.")
        return STTResponse(text="", success=False, error="Vosk STT processor not initialized")
    try:
        logger.info(f" Processing audio transcription request, format: {request.format}")
        try:
            audio_bytes = base64.b64decode(request.audio_data)
            logger.info(f" Decoded audio data: {len(audio_bytes)} bytes")
        except Exception as decode_error:
            logger.error(f"❌ Base64 decode failed: {decode_error}")
            return STTResponse(text="", success=False, error=f"Invalid base64 audio data: {decode_error}")
        if len(audio_bytes) == 0:
            logger.error("❌ Empty audio data received")
            return STTResponse(text="", success=False, error="Empty audio data received")
        max_audio_size = 50 * 1024 * 1024
        if len(audio_bytes) > max_audio_size:
            logger.error(f"❌ Audio file too large: {len(audio_bytes)} bytes")
            return STTResponse(text="", success=False, error=f"Audio file too large. Maximum size is {max_audio_size // (1024*1024)}MB")
        try:
            input_buffer = io.BytesIO(audio_bytes)
            format_to_use = request.format.lower()
            if format_to_use in ['webm', 'ogg']:
                try:
                    audio_segment = AudioSegment.from_file(input_buffer, format="webm")
                except:
                    input_buffer.seek(0)
                    try:
                        audio_segment = AudioSegment.from_file(input_buffer, format="ogg")
                    except:
                        input_buffer.seek(0)
                        audio_segment = AudioSegment.from_file(input_buffer)
            elif format_to_use == 'wav':
                audio_segment = AudioSegment.from_file(input_buffer, format="wav")
            elif format_to_use in ['mp4', 'm4a']:
                audio_segment = AudioSegment.from_file(input_buffer, format="mp4")
            else:
                audio_segment = AudioSegment.from_file(input_buffer)
            logger.info(f" Original audio: {audio_segment.frame_rate}Hz, {audio_segment.channels} channels, {audio_segment.sample_width} bytes/sample")
            target_sample_rate = request.sample_rate or SAMPLE_RATE
            target_channels = request.channels or CHANNELS
            audio_segment = (
                audio_segment
                .set_frame_rate(target_sample_rate)
                .set_channels(target_channels)
                .set_sample_width(2)
            )
            logger.info(f" Converted audio: {audio_segment.frame_rate}Hz, {audio_segment.channels} channels, {audio_segment.sample_width} bytes/sample")
            wav_buffer = io.BytesIO()
            audio_segment.export(wav_buffer, format="wav")
            wav_buffer.seek(0)
            logger.info(f"✅ Audio converted successfully: {len(wav_buffer.getvalue())} bytes WAV")
            transcription_result = stt_processor.transcribe_filelike(wav_buffer)
        except Exception as audio_error:
            logger.error(f"❌ Audio conversion failed: {audio_error}")
            temp_audio_path = DEBUG_AUDIO_DIR / f"temp_upload_{int(time.time())}.{request.format}"
            try:
                with open(temp_audio_path, "wb") as f:
                    f.write(audio_bytes)
                audio_segment = AudioSegment.from_file(str(temp_audio_path))
                audio_segment = (
                    audio_segment
                    .set_frame_rate(SAMPLE_RATE)
                    .set_channels(CHANNELS)
                    .set_sample_width(2)
                )
                processed_path = DEBUG_AUDIO_DIR / f"processed_{int(time.time())}.wav"
                audio_segment.export(str(processed_path), format="wav")
                transcription_result = stt_processor.transcribe(str(processed_path))
                os.remove(temp_audio_path)
                if transcription_result["success"]:
                    os.remove(processed_path)
                else:
                    logger.error(f"Saved failed processed audio: {processed_path}")
            except Exception as fallback_error:
                logger.error(f"❌ Fallback audio processing failed: {fallback_error}")
                return STTResponse(text="", success=False, error=f"Audio processing failed: {fallback_error}")
        if transcription_result["success"]:
            transcript = transcription_result["text"].strip()
            if transcript:
                logger.info(f"✅ Transcription successful: '{transcript}'")
                return STTResponse(text=transcript, success=True)
            else:
                logger.warning("⚠️ Transcription returned empty text")
                return STTResponse(text="", success=False, error="No speech detected in audio")
        else:
            logger.error(f"❌ Transcription failed: {transcription_result['error']}")
            return STTResponse(text="", success=False, error=transcription_result["error"])
    except base64.binascii.Error:
        logger.error("❌ Invalid Base64 data received.")
        return STTResponse(text="", success=False, error="Invalid Base64 audio data")
    except Exception as e:
        logger.error(f"❌ Unexpected error during file transcription: {e}", exc_info=True)
        return STTResponse(text="", success=False, error=f"Unexpected error: {e}")
class ChatLLMRequest(BaseModel):
    chat_id: str
    prompt: str
    model: str = DEFAULT_MODEL
    stream: bool = False
    system_prompt: Optional[str] = None
@app.post("/llm/generate")
async def generate_llm_response(request: LLMRequest) -> LLMResponse:
    """Generate LLM response via Ollama (legacy endpoint)."""
    try:
        logger.info(f" LLM request: model={request.model}, prompt_length={len(request.prompt)}")
        ollama_request = {
            "model": request.model,
            "prompt": request.prompt,
            "stream": False
        }
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=ollama_request,
            timeout=60
        )
        if response.status_code == 200:
            result = response.json()
            llm_response = result.get('response', '').strip()
            if llm_response:
                logger.info(f"✅ LLM response generated (length: {len(llm_response)})")
                return LLMResponse(
                    response=llm_response,
                    model=request.model,
                    success=True
                )
            else:
                logger.error("❌ Empty response from Ollama")
                return LLMResponse(
                    response="",
                    model=request.model,
                    success=False,
                    error="Empty response from LLM"
                )
        else:
            error_text = response.text()
            logger.error(f"❌ Ollama API error {response.status_code}: {error_text}")
            return LLMResponse(
                response="",
                model=request.model,
                success=False,
                error=f"Ollama API error {response.status_code}: {error_text}"
            )
    except requests.RequestException as e:
        logger.error(f"❌ Request to Ollama failed: {e}")
        return LLMResponse(
            response="",
            model=request.model,
            success=False,
            error=f"Cannot connect to Ollama: {e}"
        )
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return LLMResponse(
            response="",
            model=request.model,
            success=False,
            error=f"Unexpected error: {e}"
        )
@app.post("/llm/chat-generate")
async def generate_chat_llm_response(request: ChatLLMRequest) -> LLMResponse:
    """Generate context-aware LLM response for a chat session."""
    try:
        logger.info(f" [LLM PIPELINE] Chat LLM request: chat_id={request.chat_id}, model={request.model}")
        logger.info(f" [LLM PIPELINE] Received prompt from STT: '{request.prompt[:100]}{'...' if len(request.prompt) > 100 else ''}'")
        context_data = session_manager.get_context_for_session(
            request.chat_id,
            request.system_prompt,
            request.model
        )
        if not context_data:
            logger.error(f"❌ [LLM PIPELINE] Chat session {request.chat_id} not found")
            return LLMResponse(
                response="",
                model=request.model,
                success=False,
                error=f"Chat session {request.chat_id} not found"
            )
        logger.info(f"️ [LLM PIPELINE] Context loaded: {len(context_data['messages'])} messages")
        context_messages = context_data["messages"]
        context_messages.append({
            "role": "user",
            "content": request.prompt
        })
        formatted_prompt = ""
        for msg in context_messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                formatted_prompt += f"System: {content}\n\n"
            elif role == "user":
                formatted_prompt += f"User: {content}\n\n"
            elif role == "assistant":
                formatted_prompt += f"Assistant: {content}\n\n"
        formatted_prompt += "Assistant: "
        logger.info(f" [LLM PIPELINE] Context: {len(context_messages)} messages, {context_data['total_tokens']} tokens ({context_data['token_utilization']:.1f}% utilization)")
        logger.info(f" [LLM PIPELINE] Sending request to Ollama with {len(formatted_prompt)} character prompt")
        ollama_request = {
            "model": request.model,
            "prompt": formatted_prompt,
            "stream": request.stream
        }
        logger.info(f" [LLM PIPELINE] Making request to {OLLAMA_BASE_URL}/api/generate")
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=ollama_request,
            timeout=120
        )
        logger.info(f" [LLM PIPELINE] Ollama response status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            llm_response = result.get('response', '').strip()
            logger.info(f" [LLM PIPELINE] Raw Ollama response length: {len(llm_response)}")
            if llm_response:
                logger.info(f" [LLM PIPELINE] Saving response to chat session {request.chat_id}")
                session_manager.add_message(request.chat_id, llm_response, "assistant", request.model)
                logger.info(f"✅ [LLM PIPELINE] Chat LLM response generated successfully (length: {len(llm_response)})")
                logger.info(f" [LLM PIPELINE] Response preview: '{llm_response[:100]}{'...' if len(llm_response) > 100 else ''}'")
                return LLMResponse(
                    response=llm_response,
                    model=request.model,
                    success=True
                )
            else:
                logger.error("❌ [LLM PIPELINE] Empty response from Ollama")
                return LLMResponse(
                    response="",
                    model=request.model,
                    success=False,
                    error="Empty response from LLM"
                )
        else:
            error_text = response.text()
            logger.error(f"❌ [LLM PIPELINE] Ollama API error {response.status_code}: {error_text}")
            return LLMResponse(
                response="",
                model=request.model,
                success=False,
                error=f"Ollama API error {response.status_code}: {error_text}"
            )
    except requests.RequestException as e:
        logger.error(f"❌ [LLM PIPELINE] Request to Ollama failed: {e}")
        return LLMResponse(
            response="",
            model=request.model,
            success=False,
            error=f"Cannot connect to Ollama: {e}"
        )
    except Exception as e:
        logger.error(f"❌ [LLM PIPELINE] Unexpected error: {e}", exc_info=True)
        return LLMResponse(
            response="",
            model=request.model,
            success=False,
            error=f"Unexpected error: {e}"
        )
@app.websocket("/llm/stream")
async def websocket_llm_stream(websocket: WebSocket):
    """WebSocket endpoint for streaming LLM responses."""
    await websocket.accept()
    logger.info(" LLM WebSocket connected")
    try:
        while True:
            data = await websocket.receive_json()
            prompt = data.get('prompt', '')
            model = data.get('model', DEFAULT_MODEL)
            if not prompt:
                await websocket.send_json({
                    'type': 'error',
                    'data': 'Empty prompt provided'
                })
                continue
            logger.info(f" Streaming LLM request: model={model}, prompt_length={len(prompt)}")
            try:
                ollama_request = {
                    "model": model,
                    "prompt": prompt,
                    "stream": True
                }
                response = requests.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json=ollama_request,
                    stream=True,
                    timeout=60
                )
                if response.status_code == 200:
                    for line in response.iter_lines():
                        if line:
                            try:
                                chunk_data = json.loads(line.decode('utf-8'))
                                chunk_text = chunk_data.get('response', '')
                                is_done = chunk_data.get('done', False)
                                if chunk_text:
                                    await websocket.send_json({
                                        'type': 'chunk',
                                        'data': chunk_text
                                    })
                                if is_done:
                                    await websocket.send_json({
                                        'type': 'complete',
                                        'data': 'Stream completed'
                                    })
                                    break
                            except json.JSONDecodeError:
                                continue
                else:
                    await websocket.send_json({
                        'type': 'error',
                        'data': f'Ollama API error: {response.status_code}'
                    })
            except Exception as e:
                logger.error(f"❌ Streaming error: {e}")
                await websocket.send_json({
                    'type': 'error',
                    'data': f'Streaming error: {e}'
                })
    except WebSocketDisconnect:
        logger.info(" LLM WebSocket disconnected")
    except Exception as e:
        logger.error(f"❌ LLM WebSocket error: {e}")
    finally:
        logger.info(" LLM WebSocket cleanup completed")
async def _stt_listener(websocket: WebSocket, recognizer):
    """Handle incoming audio data and control messages"""
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.receive":
                if message.get("bytes") is not None:
                    audio_data = message["bytes"]
                    logger.debug(f" Received audio data: {len(audio_data)} bytes")
                    try:
                        if recognizer.AcceptWaveform(audio_data):
                            result = json.loads(recognizer.Result())
                            if result.get('text', '').strip():
                                await websocket.send_json({
                                    'type': 'final',
                                    'text': result['text'],
                                    'timestamp': time.time()
                                })
                                logger.info(f" Final result: {result['text']}")
                        else:
                            partial = json.loads(recognizer.PartialResult())
                            if partial.get('partial', '').strip():
                                await websocket.send_json({
                                    'type': 'partial',
                                    'text': partial['partial'],
                                    'timestamp': time.time()
                                })
                    except Exception as vosk_error:
                        logger.error(f"❌ Vosk processing error: {vosk_error}")
                        await websocket.send_json({
                            'type': 'error',
                            'text': f'Speech processing error: {vosk_error}',
                            'timestamp': time.time()
                        })
                elif message.get("text") is not None:
                    try:
                        control_message = json.loads(message["text"])
                        if control_message.get('action') == 'stop':
                            logger.info("⏹️ Received stop command")
                            break
                        elif control_message.get('type') == 'pong':
                            logger.debug(" Received pong")
                    except json.JSONDecodeError:
                        logger.warning("⚠️ Invalid JSON control message")
            elif message["type"] in ("websocket.disconnect", "websocket.close"):
                logger.info(" WebSocket disconnected")
                break
    except Exception as e:
        logger.error(f"❌ STT listener error: {e}")
        raise
async def _stt_ping_keepalive(websocket: WebSocket):
    """Send periodic ping messages to keep connection alive"""
    try:
        while True:
            await asyncio.sleep(10)
            try:
                await websocket.send_json({
                    'type': 'ping',
                    'timestamp': time.time()
                })
                logger.debug(" Sent ping")
            except Exception as ping_error:
                logger.error(f"❌ Failed to send ping: {ping_error}")
                break
    except asyncio.CancelledError:
        logger.debug(" Ping task cancelled")
    except Exception as e:
        logger.error(f"❌ Ping keepalive error: {e}")
@app.websocket("/stt/stream")
async def websocket_stt_stream(websocket: WebSocket):
    """WebSocket endpoint for real-time STT streaming with improved stability."""
    await websocket.accept()
    logger.info(" STT WebSocket connected")
    try:
        if not stt_processor:
            await websocket.send_json({
                'type': 'error',
                'message': 'Vosk not initialized',
                'timestamp': time.time()
            })
            logger.error("❌ Vosk instance not initialized for STT streaming")
            return
        recognizer = vosk.KaldiRecognizer(stt_processor.model, SAMPLE_RATE)
        logger.info(" Started real-time STT session")
        await websocket.send_json({
            'type': 'ready',
            'message': 'STT WebSocket ready',
            'timestamp': time.time()
        })
        listener_task = asyncio.create_task(_stt_listener(websocket, recognizer))
        ping_task = asyncio.create_task(_stt_ping_keepalive(websocket))
        done, pending = await asyncio.wait(
            [listener_task, ping_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    except Exception as e:
        logger.error(f"❌ STT WebSocket error: {e}")
        try:
            await websocket.send_json({
                'type': 'error',
                'text': f'WebSocket error: {e}',
                'timestamp': time.time()
            })
        except:
            pass
    finally:
        logger.info(" STT WebSocket cleanup completed")
class TTSRequest(BaseModel):
    text: str
    voice: str = "en"
    speed: float = 1.0
class TTSResponse(BaseModel):
    success: bool
    audio_data: Optional[str] = None
    error: Optional[str] = None
@app.post("/tts/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest):
    """Synthesize speech from text using pyttsx3."""
    try:
        import pyttsx3
        import tempfile
        import base64
        logger.info(f" Synthesizing speech: {request.text[:50]}...")
        engine = pyttsx3.init()
        engine.setProperty('rate', int(150 * request.speed))
        engine.setProperty('volume', 0.9)
        voices = engine.getProperty('voices')
        if voices:
            for voice in voices:
                if 'english' in voice.name.lower() or 'en' in voice.id.lower():
                    engine.setProperty('voice', voice.id)
                    break
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        try:
            engine.save_to_file(request.text, temp_path)
            engine.runAndWait()
            with open(temp_path, 'rb') as audio_file:
                audio_data = base64.b64encode(audio_file.read()).decode('utf-8')
            logger.info("✅ Speech synthesis completed")
            return TTSResponse(
                success=True,
                audio_data=audio_data
            )
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    except ImportError:
        logger.error("❌ pyttsx3 not installed")
        return TTSResponse(
            success=False,
            error="TTS engine not available. Please install pyttsx3: pip install pyttsx3"
        )
    except Exception as e:
        logger.error(f"❌ TTS synthesis failed: {e}")
        return TTSResponse(
            success=False,
            error=f"Speech synthesis failed: {e}"
        )
@app.post("/chats/create", response_model=CreateChatResponse)
async def create_chat_session(request: CreateChatRequest):
    """Create a new chat session."""
    try:
        session = session_manager.create_session(request.title)
        return CreateChatResponse(
            chat_id=session.id,
            title=session.title,
            success=True
        )
    except Exception as e:
        logger.error(f"❌ Failed to create chat session: {e}")
        return CreateChatResponse(
            chat_id="",
            title="",
            success=False,
            error=str(e)
        )
@app.get("/chats/list", response_model=ChatListResponse)
async def list_chat_sessions():
    """List all chat sessions."""
    try:
        sessions = session_manager.list_sessions()
        return ChatListResponse(
            sessions=sessions,
            success=True
        )
    except Exception as e:
        logger.error(f"❌ Failed to list chat sessions: {e}")
        return ChatListResponse(
            sessions=[],
            success=False,
            error=str(e)
        )
@app.get("/chats/{chat_id}", response_model=ChatSessionResponse)
async def get_chat_session(chat_id: str):
    """Get a specific chat session."""
    try:
        session = session_manager.load_session(chat_id)
        if session:
            return ChatSessionResponse(
                session=session,
                success=True
            )
        else:
            return ChatSessionResponse(
                session=None,
                success=False,
                error=f"Chat session {chat_id} not found"
            )
    except Exception as e:
        logger.error(f"❌ Failed to get chat session {chat_id}: {e}")
        return ChatSessionResponse(
            session=None,
            success=False,
            error=str(e)
        )
@app.post("/chats/{chat_id}/messages")
async def add_message_to_chat(chat_id: str, request: AddMessageRequest):
    """Add a message to a chat session."""
    try:
        message = session_manager.add_message(
            chat_id,
            request.content,
            request.role,
            request.model or "gemma3n:latest"
        )
        if message:
            return {
                "success": True,
                "message": message.dict()
            }
        else:
            return {
                "success": False,
                "error": f"Failed to add message to chat {chat_id}"
            }
    except Exception as e:
        logger.error(f"❌ Failed to add message to chat {chat_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.put("/chats/{chat_id}/rename")
async def rename_chat_session(chat_id: str, request: RenameChatRequest):
    """Rename a chat session."""
    try:
        success = session_manager.rename_session(chat_id, request.new_title)
        return {
            "success": success,
            "error": None if success else f"Failed to rename chat {chat_id}"
        }
    except Exception as e:
        logger.error(f"❌ Failed to rename chat {chat_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.delete("/chats/{chat_id}")
async def delete_chat_session(chat_id: str):
    """Delete a chat session."""
    try:
        success = session_manager.delete_session(chat_id)
        return {
            "success": success,
            "error": None if success else f"Failed to delete chat {chat_id}"
        }
    except Exception as e:
        logger.error(f"❌ Failed to delete chat {chat_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.get("/chats/{chat_id}/context")
async def get_chat_context(chat_id: str, system_prompt: Optional[str] = None, model: Optional[str] = None):
    """Get token-aware context window for a chat session."""
    try:
        context_data = session_manager.get_context_for_session(
            chat_id,
            system_prompt,
            model or "gemma3n:latest"
        )
        if context_data:
            return {
                "success": True,
                **context_data
            }
        else:
            return {
                "success": False,
                "error": f"Chat session {chat_id} not found"
            }
    except Exception as e:
        logger.error(f"❌ Failed to get context for chat {chat_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.get("/hardware/info")
async def get_hardware_info():
    """Get detailed hardware information."""
    try:
        summary = get_hardware_summary()
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        logger.error(f"❌ Failed to get hardware info: {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.get("/hardware/runtime-config")
async def get_optimal_runtime_config():
    """Get optimal runtime configuration for Ollama."""
    try:
        config = get_runtime_config()
        return {
            "success": True,
            "config": {
                "mode": config.mode.value,
                "reason": config.reason,
                "ollama_args": config.ollama_args,
                "recommended_models": config.recommended_models,
                "hardware_info": {
                    "cpu_cores": config.hardware_info.cpu_cores,
                    "ram_total_mb": config.hardware_info.ram_total,
                    "ram_available_mb": config.hardware_info.ram_available,
                    "has_gpu": config.hardware_info.has_gpu,
                    "gpu_name": config.hardware_info.gpu_name,
                    "vram_total_mb": config.hardware_info.vram_total,
                    "vram_available_mb": config.hardware_info.vram_available,
                    "platform": config.hardware_info.platform_info
                }
            }
        }
    except Exception as e:
        logger.error(f"❌ Failed to get runtime config: {e}")
        return {
            "success": False,
            "error": str(e)
        }
@app.post("/hardware/refresh")
async def refresh_hardware_detection():
    """Refresh hardware detection (useful for hot-plugged GPUs)."""
    try:
        hardware_detector._detect_basic_info()
        hardware_detector.detect_gpu()
        config = get_runtime_config()
        return {
            "success": True,
            "message": "Hardware detection refreshed",
            "config": {
                "mode": config.mode.value,
                "reason": config.reason
            }
        }
    except Exception as e:
        logger.error(f"❌ Failed to refresh hardware detection: {e}")
        return {
            "success": False,
            "error": str(e)
        }
if __name__ == "__main__":
    uvicorn.run(
        "python_backend_server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
