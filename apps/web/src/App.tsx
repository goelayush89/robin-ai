import { Button } from '@robin/ui'

function App() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md mx-auto text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">
          Robin Assistant
        </h1>
        <p className="text-muted-foreground">
          A minimal Electron + React + TypeScript + Vite + Radix UI application
        </p>
        <div className="space-x-4">
          <Button>Primary Button</Button>
          <Button variant="outline">Outline Button</Button>
        </div>
      </div>
    </div>
  )
}

export default App
