import { Plugin, PluginResult, PluginContext } from '../../types';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
const manifest = {
  name: "fileWriter",
  description: "Write text content to local files with support for creating new files and appending to existing ones",
  version: "1.0.0",
  author: "Privacy AI Assistant",
  keywords: ["write", "save", "create", "file", "export"],
  triggerWords: ["write file", "save to file", "create file", "export", "write to"],
  category: "file" as const,
  permissions: ["file:write", "fs:write"]
};
class FileWriterPlugin implements Plugin {
  manifest = manifest;
  private supportedExtensions = ['.txt', '.md', '.markdown', '.json', '.csv', '.log', '.html', '.css', '.js', '.ts'];
  async run(input: string, context?: PluginContext): Promise<PluginResult> {
    try {
      const command = this.parseCommand(input);
      switch (command.action) {
        case 'write':
          return await this.writeFile(command.filePath || '', command.content || '', false);
        case 'append':
          return await this.writeFile(command.filePath || '', command.content || '', true);
        case 'create':
          return await this.createFile(command.filePath || '', command.content || '');
        default:
          return {
            success: false,
            error: 'Unknown file command. Available commands: write, append, create'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `File writer error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private parseCommand(input: string): { action: string; filePath?: string; content?: string } {
    const normalizedInput = input.toLowerCase().trim();
    let action = 'write';
    let filePath = '';
    let content = '';
    if (normalizedInput.includes('append')) {
      action = 'append';
      const match = input.match(/append\s+(?:to\s+)?(?:file\s+)?["']?([^"'\n]+?)["']?\s+(?:with\s+)?(.+)/i);
      if (match) {
        filePath = match[1].trim();
        content = match[2].trim();
      }
    }
    else if (normalizedInput.includes('create')) {
      action = 'create';
      const match = input.match(/create\s+(?:file\s+)?["']?([^"'\n]+?)["']?\s+(?:with\s+)?(.+)/i);
      if (match) {
        filePath = match[1].trim();
        content = match[2].trim();
      }
    }
    else {
      const match = input.match(/(?:write|save)\s+(?:to\s+)?(?:file\s+)?["']?([^"'\n]+?)["']?\s+(?:with\s+)?(.+)/i) ||
                   input.match(/["']?([^"'\n]+?)["']?\s+(.+)/);
      if (match) {
        filePath = match[1].trim();
        content = match[2].trim();
      }
    }
    filePath = filePath.replace(/^["']|["']$/g, '');
    content = content.replace(/^["']|["']$/g, '');
    return { action, filePath, content };
  }
  private async writeFile(filePath: string, content: string, append: boolean = false): Promise<PluginResult> {
    if (!filePath || filePath.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify a file path'
      };
    }
    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: 'Please provide content to write'
      };
    }
    try {
      if (!this.isSupportedFile(filePath)) {
        return {
          success: false,
          error: `Unsupported file type. Supported extensions: ${this.supportedExtensions.join(', ')}`
        };
      }
      let finalContent = content;
      if (append) {
        try {
          const existingContent = await readTextFile(filePath);
          finalContent = existingContent + '\n' + content;
        } catch (error) {
          console.log('File does not exist, creating new file');
        }
      }
      await writeTextFile(filePath, finalContent);
      const size = new Blob([finalContent]).size;
      const lines = finalContent.split('\n').length;
      const action = append ? 'appended to' : 'written to';
      return {
        success: true,
        message: `✅ Content ${action} "${filePath}"\nSize: ${this.formatFileSize(size)} | Lines: ${lines}`,
        data: { 
          filePath, 
          content: finalContent, 
          size, 
          lines, 
          action: append ? 'append' : 'write' 
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write to file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private async createFile(filePath: string, content: string = ''): Promise<PluginResult> {
    if (!filePath || filePath.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify a file path'
      };
    }
    try {
      try {
        await readTextFile(filePath);
        return {
          success: false,
          error: `File "${filePath}" already exists. Use 'write' to overwrite or 'append' to add content.`
        };
      } catch (error) {
      }
      if (!this.isSupportedFile(filePath)) {
        return {
          success: false,
          error: `Unsupported file type. Supported extensions: ${this.supportedExtensions.join(', ')}`
        };
      }
      await writeTextFile(filePath, content);
      const size = new Blob([content]).size;
      const lines = content.split('\n').length;
      return {
        success: true,
        message: `✅ Created new file "${filePath}"\nSize: ${this.formatFileSize(size)} | Lines: ${lines}`,
        data: { 
          filePath, 
          content, 
          size, 
          lines, 
          action: 'create' 
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
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
export const fileWriterPlugin = new FileWriterPlugin();
