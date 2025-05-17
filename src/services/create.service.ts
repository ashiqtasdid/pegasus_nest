import { Injectable } from '@nestjs/common';
import { CreateRequestDto } from 'src/create/dto/create-request.dto';

@Injectable()
export class CreateService {
  async create(data: CreateRequestDto, folderPath: string): Promise<string> {
    // Your existing creation logic
    // You can now use folderPath in your service
    return `Created folder at ${folderPath} for request with prompt: ${data.prompt}`;
  }
}