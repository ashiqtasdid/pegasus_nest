export class ChatRequestDto {
  message: string;
  pluginName?: string; // Optional for backward compatibility
  name?: string; // Optional for backward compatibility
  userId: string; // Required: User ID for user-specific plugin access
}
