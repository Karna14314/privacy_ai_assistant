import { GoogleGenerativeAI, GenerativeModel, GenerateContentStreamResult } from '@google/generative-ai';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyC757g1ptvolgutJo4JvHofjpAvhQXFoLM';
const DEFAULT_MODEL = 'gemini-1.5-flash';
const isValidApiKey = (key: string): boolean => {
  return key && key.startsWith('AIza') && key.length > 30;
};
export interface GeminiStreamOptions {
  streamId: string;
  systemPrompt?: string;
  onChunk?: (chunk: string, metadata?: any) => void;
  onComplete?: (fullContent: string, metadata?: any) => void;
  onError?: (error: string) => void;
}
export interface GeminiResponse {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {
    model: string;
    provider: string;
    tokens?: number;
    responseTime: number;
  };
}
export class GeminiApiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private activeStreams: Map<string, AbortController> = new Map();
  constructor(apiKey: string = GEMINI_API_KEY, modelName: string = DEFAULT_MODEL) {
    if (!isValidApiKey(apiKey)) {
      console.warn('⚠️ [Gemini API] Invalid or missing API key. Online mode will not work.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }
  public async startStream(
    prompt: string,
    options: GeminiStreamOptions
  ): Promise<string> {
    const { streamId, systemPrompt, onChunk, onComplete, onError } = options;
    const startTime = Date.now();
    console.log(` [Gemini API] Starting stream ${streamId}...`);
    if (this.activeStreams.has(streamId)) {
      this.stopStream(streamId);
    }
    const abortController = new AbortController();
    this.activeStreams.set(streamId, abortController);
    try {
      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\nUser: ${prompt}`
        : prompt;
      console.log(` [Gemini API] Sending prompt to ${DEFAULT_MODEL}...`);
      const result = await this.model.generateContentStream(fullPrompt);
      let fullContent = '';
      let chunkCount = 0;
      for await (const chunk of result.stream) {
        if (abortController.signal.aborted) {
          console.log(` [Gemini API] Stream ${streamId} was aborted`);
          break;
        }
        const chunkText = chunk.text();
        if (chunkText) {
          fullContent += chunkText;
          chunkCount++;
          if (onChunk) {
            const metadata = {
              model: DEFAULT_MODEL,
              provider: 'online_gemini',
              chunk: chunkText,
              chunkCount,
              totalLength: fullContent.length,
              responseTime: Date.now() - startTime
            };
            try {
              onChunk(fullContent, metadata);
            } catch (error) {
              console.error('❌ [Gemini API] Error in onChunk callback:', error);
            }
          }
        }
      }
      const responseTime = Date.now() - startTime;
      console.log(`✅ [Gemini API] Stream ${streamId} completed in ${responseTime}ms`);
      const finalMetadata = {
        model: DEFAULT_MODEL,
        provider: 'online_gemini',
        tokens: this.estimateTokenCount(fullContent),
        responseTime,
        chunkCount
      };
      if (onComplete) {
        try {
          onComplete(fullContent, finalMetadata);
        } catch (error) {
          console.error('❌ [Gemini API] Error in onComplete callback:', error);
        }
      }
      this.activeStreams.delete(streamId);
      return fullContent;
    } catch (error) {
      console.error(`❌ [Gemini API] Stream ${streamId} failed:`, error);
      this.activeStreams.delete(streamId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (onError) {
        try {
          onError(errorMessage);
        } catch (callbackError) {
          console.error('❌ [Gemini API] Error in onError callback:', callbackError);
        }
      }
      throw new Error(`Gemini API streaming failed: ${errorMessage}`);
    }
  }
  public stopStream(streamId: string): void {
    const abortController = this.activeStreams.get(streamId);
    if (abortController) {
      console.log(` [Gemini API] Stopping stream ${streamId}`);
      abortController.abort();
      this.activeStreams.delete(streamId);
    }
  }
  public stopAllStreams(): void {
    console.log(` [Gemini API] Stopping all ${this.activeStreams.size} active streams`);
    for (const [streamId, controller] of this.activeStreams) {
      controller.abort();
    }
    this.activeStreams.clear();
  }
  public async generateResponse(
    prompt: string,
    systemPrompt?: string
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    try {
      console.log(` [Gemini API] Generating single response...`);
      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\nUser: ${prompt}`
        : prompt;
      const result = await this.model.generateContent(fullPrompt);
      const content = result.response.text();
      const responseTime = Date.now() - startTime;
      console.log(`✅ [Gemini API] Response generated in ${responseTime}ms`);
      return {
        success: true,
        content,
        metadata: {
          model: DEFAULT_MODEL,
          provider: 'online_gemini',
          tokens: this.estimateTokenCount(content),
          responseTime
        }
      };
    } catch (error) {
      console.error('❌ [Gemini API] Response generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          model: DEFAULT_MODEL,
          provider: 'online_gemini',
          responseTime: Date.now() - startTime
        }
      };
    }
  }
  public async testConnectivity(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      console.log(' [Gemini API] Testing connectivity...');
      if (!isValidApiKey(GEMINI_API_KEY)) {
        throw new Error('Invalid or missing Gemini API key. Please check your configuration.');
      }
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });
      const testPromise = this.model.generateContent('Test connectivity');
      const result = await Promise.race([testPromise, timeoutPromise]);
      const latency = Date.now() - startTime;
      console.log(`✅ [Gemini API] Connectivity test passed (${latency}ms)`);
      return {
        success: true,
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ [Gemini API] Connectivity test failed:', errorMessage);
      let userFriendlyError = errorMessage;
      if (errorMessage.includes('API_KEY_INVALID')) {
        userFriendlyError = 'Invalid Gemini API key. Please check your configuration.';
      } else if (errorMessage.includes('timeout')) {
        userFriendlyError = 'Connection timeout. Please check your internet connection.';
      } else if (errorMessage.includes('PERMISSION_DENIED')) {
        userFriendlyError = 'API access denied. Please verify your API key permissions.';
      } else if (errorMessage.includes('QUOTA_EXCEEDED')) {
        userFriendlyError = 'API quota exceeded. Please check your usage limits.';
      }
      return {
        success: false,
        latency,
        error: userFriendlyError
      };
    }
  }
  public getActiveStreamCount(): number {
    return this.activeStreams.size;
  }
  public isStreamActive(streamId: string): boolean {
    return this.activeStreams.has(streamId);
  }
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
  public destroy(): void {
    console.log(' [Gemini API] Cleaning up resources...');
    this.stopAllStreams();
  }
}
export const geminiApi = new GeminiApiService();
export default GeminiApiService;
