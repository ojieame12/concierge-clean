# Insite B2B Conversational Commerce Platform

A clean, production-ready conversational commerce platform for B2B and white-label deployments.

## Overview

Insite provides an AI-powered shopping concierge that helps customers discover products through natural conversation. This repository contains the complete platform optimized for B2B deployment.

## Features

- **Conversational AI**: Powered by Google Gemini for natural product discovery
- **Hybrid Search**: Vector + lexical search for accurate product matching
- **Beautiful UI/UX**: Polished journeyv2 interface with smooth animations
- **Product Intelligence**: Advanced product knowledge and recommendations
- **Negotiation Engine**: Smart pricing and offer management
- **White-Label Ready**: Easy branding and customization

## Architecture

```
insite-b2b/
├── frontend/          # Next.js customer-facing interface
├── backend/           # Express API with conversation engine
├── shared/            # Shared types and utilities
├── deploy/            # Deployment configurations
└── docs/              # Documentation
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account (for database)
- Google Cloud account (for Gemini API)

### Installation

```bash
# Clone the repository
git clone https://github.com/ojieame12/concierge-clean.git
cd concierge-clean

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development servers
npm run dev
```

The frontend will be available at http://localhost:3300 and the backend at http://localhost:4000.

## Environment Variables

### Backend (.env in root)

```bash
# Database
DATABASE_URL=your_supabase_connection_string

# AI
GEMINI_API_KEY=your_google_ai_api_key

# API Authentication
CLIENT_API_KEYS=your_client_api_key
ADMIN_API_KEY=your_admin_api_key

# CORS
CORS_ORIGINS=http://localhost:3300,https://your-domain.com
```

### Frontend (.env.local in frontend/)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_CLIENT_KEY=your_client_api_key
NEXT_PUBLIC_JOURNEY_SHOP=your-brand-slug
```

## Development

### Frontend Development

```bash
npm run dev:frontend
```

The frontend uses:
- Next.js 14 with App Router
- Tailwind CSS for styling
- Framer Motion for animations
- Zustand for state management

### Backend Development

```bash
npm run dev:backend
```

The backend provides:
- `/api/chat` - Main conversation endpoint
- `/theme` - Branding configuration
- `/api/events` - Analytics events
- `/healthz` - Health check

## Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
cd deploy/docker
docker-compose up -d
```

### Railway Deployment

```bash
# Deploy to Railway
railway up
```

### Manual Deployment

```bash
# Build both frontend and backend
npm run build

# Start production servers
npm run start
```

## Customization

### Branding

Edit theme tokens in `frontend/src/theme/tokens.css`:

```css
:root {
  --theme-primary: #4a5d47;
  --theme-secondary: #6b7b68;
  --font-display: Optima, serif;
  --font-body: Inter, sans-serif;
}
```

### Sample Prompts

Configure in your store profile via the `/theme` endpoint or database.

### Product Catalog

Sync your product catalog via the backend API:

```bash
POST /api/catalog/sync
{
  "products": [...]
}
```

## API Documentation

### POST /api/chat

Main conversation endpoint.

**Request:**
```json
{
  "shop": "your-brand",
  "message": "Show me running shoes under $100",
  "session_id": "uuid",
  "turn_id": "uuid"
}
```

**Response:**
```json
{
  "turn": {
    "id": "uuid",
    "narrative": "Here are some great options...",
    "products": [...],
    "quick_replies": [...]
  }
}
```

### GET /theme?shop=your-brand

Get branding configuration.

**Response:**
```json
{
  "brandProfile": {
    "brand_name": "Your Brand",
    "primary_category": "Outdoor Gear",
    "sample_prompts": [...],
    "greeting": "Welcome to Your Brand"
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run frontend tests
npm run test --workspace frontend

# Run backend tests
npm run test --workspace backend
```

## Project Structure

### Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Main journeyv2 page
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── intro/             # BigIntro, MiniIntro
│   │   ├── conversation/      # Chat components
│   │   ├── products/          # Product cards, drawer
│   │   ├── animations/        # TypingText, BlurReveal
│   │   └── ui/                # Shared UI components
│   ├── hooks/                 # React hooks
│   ├── theme/                 # Design tokens
│   └── types/                 # TypeScript types
├── public/                    # Static assets
└── tailwind.config.ts         # Tailwind configuration
```

### Backend

```
backend/
├── src/
│   ├── core/
│   │   ├── conversation/      # Pipeline, intent, tone
│   │   ├── search/            # Hybrid search
│   │   ├── knowledge/         # Product intelligence
│   │   └── product-intelligence/
│   ├── routes/
│   │   ├── chat.ts            # Chat endpoint
│   │   ├── theme.ts           # Branding endpoint
│   │   └── events.ts          # Analytics endpoint
│   ├── middleware/            # CORS, auth
│   ├── infra/                 # Supabase, Gemini clients
│   └── index.ts               # Express app
└── tsconfig.json
```

## Contributing

This is a clean extraction of the core Insite platform. Contributions should focus on:

- Performance optimizations
- Better conversation quality
- Enhanced product intelligence
- Improved UI/UX

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact support@insite.com or open an issue on GitHub.

## Changelog

### Version 1.0.0 (Initial Clean Release)

- Clean extraction from monorepo
- Removed all Shopify-specific code
- Optimized for B2B/white-label deployment
- Complete UI/UX preservation
- Production-ready architecture
