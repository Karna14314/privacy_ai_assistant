import os
import shutil
import sys
try:
    from pydub import AudioSegment
    from pydub.exceptions import CouldntDecodeError
except ImportError:
    print("Error: pydub library not found.")
    print("Please install it using: pip install pydub")
    sys.exit(1)
def check_ffmpeg():
    """Checks if ffmpeg executable is accessible by pydub."""
    from pydub.utils import get_prober_name, get_encoder_name
    ffmpeg_path = AudioSegment.converter
    ffprobe_path = AudioSegment.ffmpeg
    if not os.path.exists(ffmpeg_path) or not os.path.exists(ffprobe_path):
        print("Error: FFmpeg or FFprobe not found or not accessible by pydub.")
        print("pydub requires FFmpeg for audio conversion. Please ensure:")
        print("1. FFmpeg is installed on your system.")
        print("2. The FFmpeg executables (ffmpeg.exe, ffprobe.exe) are in your system's PATH.")
        print("   - Download from: https://ffmpeg.org/download.html")
        print("   - For Windows, you might need to manually add the bin directory to PATH.")
        print("   - For Linux/macOS, it's often available via package managers (e.g., `sudo apt install ffmpeg`).")
        print("3. If you've installed FFmpeg to a custom location, you might need to set")
        print("   `pydub.AudioSegment.converter` and `pydub.AudioSegment.ffmpeg` to the full paths.")
        return False
    return True
def convert_audio_for_vosk(input_path, output_path):
    """
    Converts an audio file to a format compatible with Vosk.
    Args:
        input_path (str): Path to the input audio file.
        output_path (str): Path to save the converted WAV file.
    """
    if not check_ffmpeg():
        return
    if not os.path.exists(input_path):
        print(f"Error: Input file not found at '{input_path}'")
        return
    print(f"Starting conversion for '{input_path}'...")
    try:
        audio = AudioSegment.from_file(input_path)
        print(f"Original audio specs: {audio.frame_rate} Hz, {audio.channels} channels")
        audio = audio.set_frame_rate(16000)
        audio = audio.set_channels(1)
        audio = audio.set_sample_width(2)
        output_dir = os.path.dirname(output_path)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        audio.export(output_path, format="wav")
        print("-" * 50)
        print("✅ Conversion successful!")
        print(f"   Input:  {input_path}")
        print(f"   Output: {output_path}")
        print("   Format: WAV, 16kHz, Mono, 16-bit PCM")
        print("-" * 50)
    except CouldntDecodeError:
        print(f"Error: Could not decode '{input_path}'.")
        print("The file may be corrupted or in an unsupported format.")
        print("Ensure ffmpeg is correctly installed and can handle the file type.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
if __name__ == "__main__":
    INPUT_FILE = "input.mp3"
    OUTPUT_FILE = os.path.join("stt", "hello.wav")
    if not os.path.exists(INPUT_FILE):
        print(f"Info: '{INPUT_FILE}' not found.")
        print("Creating a dummy silent MP3 file for demonstration purposes.")
        dummy_audio = AudioSegment.silent(duration=1000, frame_rate=44100)
        dummy_audio = dummy_audio.set_channels(2)
        dummy_audio.export(INPUT_FILE, format="mp3")
        print(f"Dummy '{INPUT_FILE}' created.")
    convert_audio_for_vosk(INPUT_FILE, OUTPUT_FILE)
