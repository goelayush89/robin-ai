# Robin Assistant

A minimal project setup with Electron, React, TypeScript, Vite, Radix UI, and Turborepo.

## Project Structure

```
robin-assistant/
├── apps/
│   ├── web/          # React + Vite web application
│   └── desktop/      # Electron desktop application
├── packages/
│   ├── ui/           # Shared UI components with Radix UI
│   └── tsconfig/     # Shared TypeScript configurations
├── package.json      # Root package.json with Turborepo
└── turbo.json        # Turborepo configuration
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development servers:
   ```bash
   npm run dev
   ```

   This will start:
   - Web app at http://localhost:3000
   - Electron app (loads the web app)

3. Build all packages:
   ```bash
   npm run build
   ```

## Available Scripts

- `npm run dev` - Start all development servers
- `npm run build` - Build all packages
- `npm run lint` - Lint all packages
- `npm run type-check` - Type check all packages
- `npm run clean` - Clean all build outputs

## Individual App Scripts

### Web App (`apps/web`)
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Desktop App (`apps/desktop`)
- `npm run dev` - Start Electron in development mode
- `npm run build` - Build TypeScript
- `npm run electron:dist` - Build and package Electron app

### UI Package (`packages/ui`)
- `npm run dev` - Build in watch mode
- `npm run build` - Build the package

## Tech Stack

- **Turborepo**: Monorepo management
- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Fast build tool and dev server
- **Electron**: Desktop app framework
- **Radix UI**: Accessible UI components
- **Tailwind CSS**: Utility-first CSS framework
