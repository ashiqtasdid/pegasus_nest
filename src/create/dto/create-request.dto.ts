export class CreateRequestDto {
  prompt: string;
  name: string;
  userId: string; // Required: User ID for user-specific plugin generation
}
