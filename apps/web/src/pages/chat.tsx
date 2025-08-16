import { useEffect } from 'react';
import { ChatInterface } from '../components/chat/chat-interface';
import { useAgentStore } from '../stores/agent-store';

export function ChatPage() {
  const { currentSession, createSession } = useAgentStore();

  useEffect(() => {
    // Create a session if none exists
    if (!currentSession) {
      createSession('Chat Session');
    }
  }, [currentSession, createSession]);

  return (
    <div className="h-full">
      <ChatInterface />
    </div>
  );
}
