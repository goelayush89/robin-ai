import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Image, Paperclip } from 'lucide-react';
import { Button } from '../ui/button';
import { useAgentStore, type Message } from '../../stores/agent-store';
import { cn, formatTimestamp } from '../../lib/utils';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    messages,
    isLoading,
    agentStatus,
    lastScreenshot,
    startAgent
  } = useAgentStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      await startAgent(userInput);
    } catch (error) {
      console.error('Failed to start agent:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const MessageBubble = ({ message }: { message: Message }) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    
    return (
      <div className={cn(
        "flex gap-3 mb-4",
        isUser && "flex-row-reverse"
      )}>
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
          isUser && "bg-primary text-primary-foreground",
          !isUser && !isSystem && "bg-secondary text-secondary-foreground",
          isSystem && "bg-muted text-muted-foreground"
        )}>
          {isUser ? 'U' : isSystem ? 'S' : 'A'}
        </div>

        {/* Message Content */}
        <div className={cn(
          "flex-1 max-w-[80%]",
          isUser && "flex flex-col items-end"
        )}>
          <div className={cn(
            "rounded-lg px-4 py-2 text-sm",
            isUser && "bg-primary text-primary-foreground",
            !isUser && !isSystem && "bg-muted",
            isSystem && "bg-muted/50 text-muted-foreground border border-border"
          )}>
            <div className="whitespace-pre-wrap">{message.content}</div>
            
            {/* Screenshot attachment */}
            {message.screenshot && (
              <div className="mt-2">
                <img 
                  src={`data:image/png;base64,${message.screenshot.data}`}
                  alt="Screenshot"
                  className="max-w-full h-auto rounded border"
                />
              </div>
            )}
            
            {/* Action results */}
            {message.actionResults && message.actionResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.actionResults.map((result, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "text-xs px-2 py-1 rounded",
                      result.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    )}
                  >
                    {result.success ? '✓' : '✗'} {result.data?.action?.type || 'Action'}
                    {result.error && `: ${result.error}`}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground mt-1">
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="max-w-md">
              <h3 className="text-lg font-semibold mb-2">Welcome to Robin Assistant</h3>
              <p className="text-muted-foreground mb-4">
                I can help you automate tasks on your computer and web browser. 
                Just describe what you'd like me to do!
              </p>
              <div className="text-sm text-muted-foreground">
                <p>Examples:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>"Take a screenshot of my desktop"</li>
                  <li>"Open Google and search for 'AI automation'"</li>
                  <li>"Create a new document and type 'Hello World'"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* Typing indicator */}
            {(isLoading || isTyping) && (
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-medium">
                  A
                </div>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Screenshot Preview */}
      {lastScreenshot && (
        <div className="border-t border-border p-4">
          <div className="text-sm font-medium mb-2">Latest Screenshot</div>
          <img 
            src={`data:image/png;base64,${lastScreenshot.data}`}
            alt="Latest screenshot"
            className="max-w-full h-32 object-contain rounded border"
          />
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                agentStatus === 'running' 
                  ? "Agent is running... Please wait"
                  : "Describe what you'd like me to do..."
              }
              disabled={isLoading || agentStatus === 'running'}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] max-h-[120px]"
              rows={1}
            />
          </div>
          
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isLoading}
              className="h-10 w-10"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isLoading}
              className="h-10 w-10"
            >
              <Image className="h-4 w-4" />
            </Button>
            
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || agentStatus === 'running'}
              className="h-10 px-4"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
        
        <div className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
