# Pegasus Nest API

A powerful NestJS API for AI-powered Minecraft plugin generation with complete user isolation.

## Overview

Pegasus Nest API is a NestJS-based backend service designed to leverage AI capabilities to generate, refine, and compile Minecraft plugins based on natural language descriptions. The system features **complete user isolation**, ensuring each user's plugins are stored in dedicated directories with no cross-user access.

## Features

- **🔐 User-Specific Plugin Generation**: Create Minecraft plugins with complete user isolation
- **🤖 AI-Powered Development**: Uses Google's Gemini AI and other advanced models for intelligent code generation
- **💬 Interactive Plugin Chat**: Modify your plugins through natural language conversations
- **📁 Isolated File Management**: Each user's plugins are stored in separate directories (`generated/{userId}/`)
- **⬇️ Secure Downloads**: Download only your own plugins with proper authentication
- **🔒 Complete Security**: No cross-user data access or information leakage
- **📊 User-Specific Listings**: See only your own plugins and data
- **🛠️ Auto-Compilation**: Automatically compile Java code into working Minecraft plugins

## Technology Stack

- **Backend**: NestJS (Node.js framework)
- **AI**: Google Gemini API
- **Java Compilation**: JDK 17, Maven
- **Containerization**: Docker and Docker Compose
- **Deployment**: Manual deployment with automated scripts

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

### VPS Deployment

**Note**: All deployment is manual and Docker-based. Automatic deployment is disabled.

#### Docker-Based GitHub Deployment (Recommended)

1. Setup environment (first time only):

   ```bash
   ./setup-env.sh
   ```

2. Push code to GitHub:

   ```bash
   git add .
   git commit -m "Deploy update"
   git push origin main
   ```

3. Deploy on VPS:
   ```bash
   ssh root@37.114.41.124
   cd /opt/pegasus-nest
   git pull origin main
   ./deploy-docker.sh
   ```

#### Alternative: Direct Copy Deploy

For immediate deployment without Git commit:

1. Setup environment:

   ```bash
   ./setup-env.sh
   ```

2. Deploy using the legacy wrapper:
   ```bash
   ./deploy-vps.sh
   ```

This method automatically syncs files and deploys with Docker.

## API Documentation

### User-Specific Endpoints

All endpoints require user authentication and operate on user-specific data:

- `POST /create/plugin`: Generate a new Minecraft plugin for authenticated user
- `GET /create/plugins`: List all plugins for authenticated user
- `GET /create/download/{pluginName}`: Download user's plugin (user-specific)
- `POST /create/chat`: Chat with AI about user's plugin for modifications
- `GET /health`: Health check endpoint

### User Isolation Features

- **Directory Structure**: `generated/{userId}/{pluginName}/`
- **User-Specific Listings**: Users see only their own plugins
- **Secure Downloads**: Download access restricted to plugin owners
- **Isolated Chat**: Chat system works only with user's plugins

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
  │   └── create.controller.ts # User-specific plugin operations
  ├── health/                  # Health check functionality
  └── services/                # Core business logic services
      └── plugin-chat.service.ts # User-specific chat service

generated/                     # User-specific plugin storage
  ├── {userId1}/
  │   ├── {PluginName1}/
  │   └── {PluginName2}/
  ├── {userId2}/
  │   └── {PluginName}/
  └── ...
```

## Documentation

- **[Complete Architecture Guide](USER_SPECIFIC_PLUGIN_ARCHITECTURE.md)** - Detailed documentation of the user-specific plugin system
- **[API Documentation](API_DOCUMENTATION.md)** - Comprehensive API reference
- **[Chat System Documentation](CHAT_SYSTEM_DOCUMENTATION.md)** - Chat functionality details
- **[Authentication System](COMPLETE_USER_SYSTEM_DOCUMENTATION.md)** - User management and authentication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
