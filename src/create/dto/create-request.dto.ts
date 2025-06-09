export class CreateRequestDto {
  prompt: string;
  name: string;
  pluginName?: string; // Alternative name field for backward compatibility
  userId: string; // Required: User ID for user-specific plugin generation
  useAgents?: boolean = true; // Optional: Use advanced multi-agent system (default: true)
  useIncrementalMode?: boolean = true; // Optional: Use incremental file-by-file creation for maximum accuracy (default: true)

  // Helper method to get the plugin name from either field
  getPluginName(): string {
    return this.name || this.pluginName || '';
  }
}
