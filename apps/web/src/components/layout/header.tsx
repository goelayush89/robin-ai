import { useLocation } from 'react-router-dom';
import {
  Play,
  Pause,
  Square,
  Camera,
  Minimize2,
  Maximize2,
  X,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAgentStore, AgentStatus } from '../../stores/agent-store';
import { cn, getStatusColor, getStatusIcon } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function Header() {
  const location = useLocation();
  const {
    agentStatus,
    isLoading,
    currentSession,
    startAgent,
    pauseAgent,
    resumeAgent,
    stopAgent
  } = useAgentStore();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/local':
        return 'Local Computer Control';
      case '/browser':
        return 'Web Browser Automation';
      case '/hybrid':
        return 'Hybrid Agent Control';
      case '/chat':
        return 'Interactive Chat';
      case '/history':
        return 'Session History';
      case '/settings':
        return 'Settings';
      default:
        return 'Robin Assistant';
    }
  };

  const handleStartAgent = async () => {
    // This would typically open a dialog to get the instruction
    // For now, use a simple prompt
    const instruction = prompt('Enter your instruction:');
    if (instruction) {
      await startAgent(instruction);
    }
  };

  const handleTakeScreenshot = async () => {
    // This would call the IPC to take a screenshot
    // For now, simulate it
    console.log('Taking screenshot...');
  };

  const canStart = agentStatus === AgentStatus.IDLE || agentStatus === AgentStatus.STOPPED;
  const canPause = agentStatus === AgentStatus.RUNNING;
  const canResume = agentStatus === AgentStatus.PAUSED;
  const canStop = agentStatus === AgentStatus.RUNNING || agentStatus === AgentStatus.PAUSED;

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      {/* Left side - Page title and session info */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
          {currentSession && (
            <p className="text-sm text-muted-foreground">
              {currentSession.name}
            </p>
          )}
        </div>
      </div>

      {/* Center - Agent controls */}
      <div className="flex items-center gap-2">
        {canStart && (
          <Button
            onClick={handleStartAgent}
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Start
          </Button>
        )}
        
        {canPause && (
          <Button
            onClick={pauseAgent}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}
        
        {canResume && (
          <Button
            onClick={resumeAgent}
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Resume
          </Button>
        )}
        
        {canStop && (
          <Button
            onClick={stopAgent}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        )}

        <Button
          onClick={handleTakeScreenshot}
          disabled={isLoading}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          Screenshot
        </Button>
      </div>

      {/* Right side - Status and window controls */}
      <div className="flex items-center gap-4">
        {/* Agent Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="flex items-center gap-1">
            <span className="text-sm">{getStatusIcon(agentStatus)}</span>
            <span className={cn("text-sm font-medium capitalize", getStatusColor(agentStatus))}>
              {agentStatus}
            </span>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Minimize2 className="h-4 w-4 mr-2" />
                Minimize
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Maximize2 className="h-4 w-4 mr-2" />
                Maximize
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <X className="h-4 w-4 mr-2" />
                Close
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
