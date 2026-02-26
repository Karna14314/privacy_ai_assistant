"""
Upgrade Vosk Model to a Better Version
This script downloads and installs a better Vosk model for improved transcription accuracy.
Available models:
- vosk-model-en-us-0.22 (Large, ~1.8GB, best accuracy)
- vosk-model-en-us-0.22-lgraph (Medium, ~128MB, good accuracy)
- vosk-model-small-en-us-0.15 (Small, ~40MB, current model)
"""
import os
import sys
import requests
import zipfile
import shutil
from pathlib import Path
import tempfile
MODELS = {
    'large': {
        'name': 'vosk-model-en-us-0.22',
        'url': 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip',
        'size': '1.8GB',
        'description': 'Large model with best accuracy'
    },
    'medium': {
        'name': 'vosk-model-en-us-0.22-lgraph',
        'url': 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip',
        'size': '128MB',
        'description': 'Medium model with good accuracy and reasonable size'
    },
    'current': {
        'name': 'vosk-model-small-en-us-0.15',
        'size': '40MB',
        'description': 'Current small model (already installed)'
    }
}
def download_with_progress(url, filepath):
    """Download file with progress bar"""
    print(f" Downloading from {url}")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0
    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    progress = (downloaded / total_size) * 100
                    print(f"\r Progress: {progress:.1f}% ({downloaded:,} / {total_size:,} bytes)", end='', flush=True)
    print(f"\n✅ Download completed: {filepath}")
def extract_model(zip_path, extract_to):
    """Extract model zip file"""
    print(f" Extracting {zip_path} to {extract_to}")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    print("✅ Extraction completed")
def backup_current_model(models_dir):
    """Backup current model"""
    current_model = models_dir / "vosk-model-small-en-us-0.15"
    backup_model = models_dir / "vosk-model-small-en-us-0.15.backup"
    if current_model.exists():
        if backup_model.exists():
            shutil.rmtree(backup_model)
        print(f" Backing up current model to {backup_model}")
        shutil.move(str(current_model), str(backup_model))
        print("✅ Backup completed")
def update_backend_config(models_dir, new_model_name):
    """Update backend configuration to use new model"""
    backend_file = Path("python_backend_server.py")
    if not backend_file.exists():
        print("⚠️ Backend file not found, you'll need to manually update the model path")
        return
    with open(backend_file, 'r', encoding='utf-8') as f:
        content = f.read()
    old_path = 'models/vosk/vosk-model-small-en-us-0.15'
    new_path = f'models/vosk/{new_model_name}'
    if old_path in content:
        content = content.replace(old_path, new_path)
        with open(backend_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Updated backend configuration to use {new_model_name}")
    else:
        print("⚠️ Could not find model path in backend file, please update manually")
def main():
    print(" VOSK MODEL UPGRADE UTILITY")
    print("=" * 50)
    print("Available models:")
    for key, model in MODELS.items():
        print(f"  {key}: {model['name']} ({model['size']}) - {model['description']}")
    print("\n" + "=" * 50)
    while True:
        choice = input("Choose model to install (large/medium/current): ").lower().strip()
        if choice in MODELS:
            break
        print("❌ Invalid choice. Please choose 'large', 'medium', or 'current'")
    if choice == 'current':
        print("✅ Current model is already installed")
        return
    model_info = MODELS[choice]
    model_name = model_info['name']
    model_url = model_info['url']
    print(f"\n Selected: {model_name}")
    print(f" Size: {model_info['size']}")
    print(f" Description: {model_info['description']}")
    confirm = input(f"\nProceed with download? This will replace the current model. (y/N): ").lower().strip()
    if confirm != 'y':
        print("❌ Installation cancelled")
        return
    models_dir = Path("models/vosk")
    models_dir.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp())
    zip_path = temp_dir / f"{model_name}.zip"
    try:
        download_with_progress(model_url, zip_path)
        backup_current_model(models_dir)
        extract_model(zip_path, models_dir)
        update_backend_config(models_dir, model_name)
        print("\n" + "=" * 50)
        print(" MODEL UPGRADE COMPLETED!")
        print(f"✅ Installed: {model_name}")
        print(f" Location: {models_dir / model_name}")
        print(" Previous model backed up")
        print(" Backend configuration updated")
        print("\n Please restart the backend server to use the new model")
        print("=" * 50)
    except Exception as e:
        print(f"\n❌ Error during installation: {e}")
        print(" You may need to restore from backup or reinstall manually")
        sys.exit(1)
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
if __name__ == "__main__":
    main()
