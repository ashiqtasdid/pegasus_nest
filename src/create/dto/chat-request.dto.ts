export class ChatRequestDto {
  message: string;
  pluginName?: string; // Optional for backward compatibility
  name?: string; // Optional for backward compatibility
}
