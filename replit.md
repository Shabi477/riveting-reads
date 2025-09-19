# Riveting Reads - Read-Along Learning Platform

## Overview

Riveting Reads is an interactive language learning platform that combines audio storytelling with vocabulary acquisition. The system provides read-along experiences where users can listen to Spanish stories while following highlighted text, and tap on any word to learn its meaning and save it for later review. The platform includes access code redemption for KDP (Kindle Direct Publishing) companion books and implements a spaced repetition system for vocabulary retention.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 15 with React 19 and TypeScript
- **Styling**: TailwindCSS 4 for modern, responsive UI design
- **State Management**: React Query (@tanstack/react-query) for server state management
- **HTTP Client**: Axios for API communication
- **Validation**: Zod for runtime type checking and validation
- **Authentication**: Cookie-based JWT token storage with HttpOnly cookies for security
- **Routing**: File-based routing with middleware for authentication guards

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API endpoints
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JWT tokens with bcrypt password hashing
- **Security**: CORS enabled, rate limiting on auth endpoints, express-rate-limit middleware
- **Development**: tsx for TypeScript execution in development

### AI-Powered Timing Synchronization
- **Speech Recognition**: OpenAI Whisper for analyzing generated audio files
- **Perfect Timing**: AI analyzes actual MP3 audio to provide millisecond-precise word timestamps
- **Spanish Optimization**: Whisper model specifically configured for Spanish language processing
- **Quality Levels**: Perfect, good, or fallback accuracy based on AI analysis confidence
- **Synchronization Solution**: Eliminates timing drift by using actual audio analysis instead of synthetic estimates

### Database Design
- **Primary Database**: PostgreSQL with connection pooling
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Core Tables**:
  - `users`: User accounts with email/password and role-based access
  - `books`: Story books with KDP access codes and metadata
  - `chapters`: Individual story chapters with audio and JSON content URLs
  - `entitlements`: User access permissions to specific books
  - `saved_words`: User vocabulary with spaced repetition scheduling
  - `access_codes`: Redeemable codes for book access (admin-generated)
  - `admin_actions`: Audit log for administrative activities

### Authentication System
- **User Authentication**: JWT-based with secure HttpOnly cookies
- **Role-Based Access**: User and admin roles with middleware guards
- **Session Management**: 7-day token expiration with automatic renewal
- **Security Features**: Rate limiting, password strength requirements, email validation

### API Architecture
- **REST Endpoints**: Organized by resource (auth, books, words, admin)
- **Middleware Chain**: CORS, JSON parsing, authentication guards, rate limiting
- **Error Handling**: Consistent error responses with proper HTTP status codes
- **Admin Routes**: Separate middleware for admin-only operations

## External Dependencies

### Core Infrastructure
- **Database**: PostgreSQL for persistent data storage
- **File Storage**: External URLs for audio files and JSON content (chapters)
- **Image Hosting**: External URLs for book cover images

### Third-Party Integrations
- **KDP Integration**: Access code system for printed book companions
- **Audio Content**: External hosting for Spanish audio narration files
- **Content Management**: JSON-based chapter content with word-level metadata

### Development Tools
- **Package Managers**: npm with lock files for dependency management
- **Type Safety**: TypeScript across frontend and backend
- **Database Tools**: Drizzle Studio for database visualization and management
- **Build Tools**: Next.js built-in bundling and optimization