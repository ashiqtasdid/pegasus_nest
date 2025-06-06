# Pegasus Nest API

A powerful NestJS API for AI-powered Minecraft plugin generation.

## Overview

Pegasus Nest API is a NestJS-based backend service designed to leverage AI capabilities to generate, refine, and compile Minecraft plugins based on natural language descriptions. The system uses Google's Gemini AI to create Java code for Minecraft plugins, compile them, and provide feedback.

## Features

- **AI-Powered Plugin Generation**: Create Minecraft plugins from natural language descriptions
- **Code Compilation**: Automatically compile Java code into working Minecraft plugins
- **Plugin Chat**: Interact with your plugin through chat to make modifications
- **Prompt Refinement**: Improve prompts for better plugin generation
- **Security**: Comprehensive security measures to protect your API
- **Logging and Monitoring**: Track performance and diagnose issues easily

## Technology Stack

- **Backend**: NestJS (Node.js framework)
- **AI**: Google Gemini API
- **Java Compilation**: JDK 17, Maven
- **Containerization**: Docker and Docker Compose
- **Deployment**: CI/CD with GitHub Actions

## Getting Started

### Prerequisites

- Node.js (v20+)
- pnpm
- Docker and Docker Compose (for containerized deployment)
- JDK 17
- Maven

### Local Development

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/pegasus_nest.git
   cd pegasus_nest
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env` file in the root directory with the following content:

   ```
   NODE_ENV=development
   OPENROUTER_API_KEY=your_api_key_here
   PORT=3000
   ```

4. Start the development server:

   ```bash
   pnpm run start:dev
   ```

5. The API will be available at http://localhost:3000

### Docker Deployment

1. Build and start the Docker container:

   ```bash
   docker-compose up -d
   ```

2. The API will be available at http://localhost:3000

## API Documentation

### Endpoints

- `POST /create/plugin`: Generate a new Minecraft plugin
- `POST /create/chat`: Chat with the AI about your plugin for modifications
- `GET /health`: Health check endpoint

## Project Structure

```
src/
  ├── app.controller.ts        # Main application controller
  ├── app.module.ts            # Main application module
  ├── app.service.ts           # Main application service
  ├── main.ts                  # Application entry point
  ├── common/                  # Common utilities and services
  ├── controllers/             # API controllers
  ├── create/                  # Plugin creation functionality
  ├── health/                  # Health check functionality
  └── services/                # Core business logic services
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
