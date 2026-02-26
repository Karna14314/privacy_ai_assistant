import { Plugin, PluginResult, PluginContext } from '../../types';
import { readTextFile } from '@tauri-apps/plugin-fs';
const manifest = {
  name: "fileReader",
  description: "Read content from local .txt and .md files with support for file browsing",
  version: "1.0.0",
  author: "Privacy AI Assistant",
  keywords: ["read", "file", "open", "text", "markdown"],
  triggerWords: ["read file", "open file", "show file", "file content", "read"],
  category: "file" as const,
  permissions: ["file:read", "fs:read"]
};
class FileReaderPlugin implements Plugin {
  manifest = manifest;
  private supportedExtensions = ['.txt', '.md', '.markdown', '.json', '.csv', '.log'];
  async run(input: string, context?: PluginContext): Promise<PluginResult> {
    try {
      const command = this.parseCommand(input);
      switch (command.action) {
        case 'read':
          return await this.readFile(command.filePath);
        case 'preview':
          return await this.previewFile(command.filePath, command.lines);
        case 'info':
          return await this.getFileInfo(command.filePath);
        default:
          return {
            success: false,
            error: 'Unknown file command. Available commands: read, preview, info'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `File reader error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private parseCommand(input: string): { action: string; filePath?: string; lines?: number } {
    const normalizedInput = input.toLowerCase().trim();
    const filePath = this.extractFilePath(input);
    if (normalizedInput.includes('preview') || normalizedInput.includes('peek')) {
      const lines = this.extractLineCount(input) || 20;
      return { action: 'preview', filePath, lines };
    }
    if (normalizedInput.includes('info') || normalizedInput.includes('details')) {
      return { action: 'info', filePath };
    }
    return { action: 'read', filePath };
  }
  private extractFilePath(input: string): string {
    let cleanInput = input.replace(/^(read|open|show|preview|peek|info|details)\s+(file)?\s*/i, '').trim();
    cleanInput = cleanInput.replace(/^["']|["']$/g, '');
    return cleanInput;
  }
  private extractLineCount(input: string): number | undefined {
    const match = input.match(/(\d+)\s*(lines?|rows?)/i);
    return match ? parseInt(match[1], 10) : undefined;
  }
  private async readFile(filePath: string): Promise<PluginResult> {
    if (!filePath || filePath.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify a file path to read'
      };
    }
    try {
      if (!this.isSupportedFile(filePath)) {
        return {
          success: false,
          error: `Unsupported file type. Supported extensions: ${this.supportedExtensions.join(', ')}`
        };
      }
      const content = await readTextFile(filePath);
      if (!content || content.trim().length === 0) {
        return {
          success: true,
          message: `File "${filePath}" is empty`,
          data: { filePath, content: '', size: 0, lines: 0 }
        };
      }
      const lines = content.split('\n').length;
      const size = new Blob([content]).size;
      let message = ` **File: ${filePath}**\n`;
      message += `Size: ${this.formatFileSize(size)} | Lines: ${lines}\n\n`;
      if (content.length > 5000) {
        const truncated = content.substring(0, 4900);
        message += `${truncated}\n\n... (content truncated, showing first 5000 characters)`;
      } else {
        message += content;
      }
      return {
        success: true,
        message,
        data: { filePath, content, size, lines }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private async previewFile(filePath: string, maxLines: number = 20): Promise<PluginResult> {
    if (!filePath || filePath.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify a file path to preview'
      };
    }
    try {
      if (!this.isSupportedFile(filePath)) {
        return {
          success: false,
          error: `Unsupported file type. Supported extensions: ${this.supportedExtensions.join(', ')}`
        };
      }
      const content = await readTextFile(filePath);
      if (!content || content.trim().length === 0) {
        return {
          success: true,
          message: `File "${filePath}" is empty`,
          data: { filePath, preview: '', totalLines: 0 }
        };
      }
      const lines = content.split('\n');
      const previewLines = lines.slice(0, maxLines);
      const preview = previewLines.join('\n');
      let message = ` **Preview: ${filePath}**\n`;
      message += `Showing ${previewLines.length} of ${lines.length} lines\n\n`;
      message += preview;
      if (lines.length > maxLines) {
        message += `\n\n... (${lines.length - maxLines} more lines)`;
      }
      return {
        success: true,
        message,
        data: { filePath, preview, totalLines: lines.length, previewLines: previewLines.length }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to preview file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private async getFileInfo(filePath: string): Promise<PluginResult> {
    if (!filePath || filePath.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify a file path to get info'
      };
    }
    try {
      const content = await readTextFile(filePath);
      const lines = content.split('\n').length;
      const size = new Blob([content]).size;
      const words = content.split(/\s+/).filter(word => word.length > 0).length;
      const chars = content.length;
      const extension = filePath.split('.').pop()?.toLowerCase() || 'unknown';
      const fileName = filePath.split('/').pop() || filePath;
      let message = `ℹ️ **File Information**\n\n`;
      message += `**Name:** ${fileName}\n`;
      message += `**Path:** ${filePath}\n`;
      message += `**Type:** ${extension.toUpperCase()} file\n`;
      message += `**Size:** ${this.formatFileSize(size)}\n`;
      message += `**Lines:** ${lines.toLocaleString()}\n`;
      message += `**Words:** ${words.toLocaleString()}\n`;
      message += `**Characters:** ${chars.toLocaleString()}\n`;
      return {
        success: true,
        message,
        data: { 
          filePath, 
          fileName, 
          extension, 
          size, 
          lines, 
          words, 
          chars,
          isEmpty: content.trim().length === 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get file info for "${filePath}": ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private isSupportedFile(filePath: string): boolean {
    const extension = '.' + filePath.split('.').pop()?.toLowerCase();
    return this.supportedExtensions.includes(extension);
  }
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
export const fileReaderPlugin = new FileReaderPlugin();
