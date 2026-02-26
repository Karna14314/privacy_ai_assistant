interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_ENABLE_VOICE_FEATURES: string
  readonly VITE_ENABLE_AUDIO_FEATURES: string
  readonly TAURI_DEBUG: string
  readonly TAURI_PLATFORM: string
  readonly TAURI_ARCH: string
  readonly TAURI_FAMILY: string
  readonly TAURI_PLATFORM_VERSION: string
  readonly TAURI_PLATFORM_TYPE: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
