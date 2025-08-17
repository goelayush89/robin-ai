import { useEffect, useState } from 'react';
import { ChatInterface } from '../components/chat/chat-interface';
import { useAgentStore } from '../stores/agent-store';
import { useAgentConfig } from '../hooks/use-agent-config';
import { ScreenCaptureSetup } from '../components/screen-capture/screen-capture-setup';
import { isScreenCaptureSupported } from '../services/browser-screen-capture';

export function ChatPage() {
  const { currentSession, createSession } = useAgentStore();
  const { isConfigured } = useAgentConfig();
  const [screenCaptureGranted, setScreenCaptureGranted] = useState(false);
  const [showScreenCaptureSetup, setShowScreenCaptureSetup] = useState(false);

  useEffect(() => {
    // Create a session if none exists
    if (!currentSession) {
      createSession('Chat Session');
    }
  }, [currentSession, createSession]);

  useEffect(() => {
    // Check if screen capture is supported and needed
    if (isConfigured && isScreenCaptureSupported() && !screenCaptureGranted) {
      setShowScreenCaptureSetup(true);
    }
  }, [isConfigured, screenCaptureGranted]);

  if (!isConfigured) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Agent Not Configured</h2>
          <p className="text-muted-foreground">
            Please configure your AI model in Settings before using the chat interface.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  if (showScreenCaptureSetup) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <ScreenCaptureSetup
          onPermissionGranted={() => {
            setScreenCaptureGranted(true);
            setShowScreenCaptureSetup(false);
          }}
          onPermissionDenied={() => {
            setShowScreenCaptureSetup(false);
            // Could show a warning or alternative options
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChatInterface />
    </div>
  );
}
