
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  MessageSquare, 
  Settings, 
  History, 
  ChevronLeft,
  ChevronRight,
  Bot,
  Monitor,
  Globe,
  Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAgentStore } from '../../stores/agent-store';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { currentAgent, agentStatus, sessions } = useAgentStore();

  const navigationItems = [
    {
      to: '/',
      icon: Home,
      label: 'Home',
      description: 'Dashboard and quick actions'
    },
    {
      to: '/local',
      icon: Monitor,
      label: 'Local Computer',
      description: 'Control local desktop applications'
    },
    {
      to: '/browser',
      icon: Globe,
      label: 'Web Browser',
      description: 'Automate web browser tasks'
    },
    {
      to: '/hybrid',
      icon: Layers,
      label: 'Hybrid Mode',
      description: 'Combined desktop and web control'
    },
    {
      to: '/chat',
      icon: MessageSquare,
      label: 'Chat',
      description: 'Interactive conversation with agent'
    },
    {
      to: '/history',
      icon: History,
      label: 'History',
      description: 'View past sessions and conversations'
    },
    {
      to: '/settings',
      icon: Settings,
      label: 'Settings',
      description: 'Configure models, operators, and preferences'
    }
  ];

  const NavItem = ({ item }: { item: typeof navigationItems[0] }) => {
    const content = (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            isActive && "bg-accent text-accent-foreground",
            collapsed && "justify-center px-2"
          )
        }
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && (
          <span className="font-medium">{item.label}</span>
        )}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            <div>
              <div className="font-medium">{item.label}</div>
              <div className="text-sm text-muted-foreground">{item.description}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <TooltipProvider>
      <div className={cn(
        "fixed left-0 top-0 h-full bg-card border-r border-border transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg">Robin</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Agent Status */}
          {!collapsed && (
            <div className="p-4 border-b border-border">
              <div className="text-sm font-medium mb-2">Agent Status</div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  agentStatus === 'running' && "bg-green-500",
                  agentStatus === 'paused' && "bg-yellow-500",
                  agentStatus === 'error' && "bg-red-500",
                  agentStatus === 'idle' && "bg-gray-400"
                )} />
                <span className="text-sm capitalize">{agentStatus}</span>
              </div>
              {currentAgent && (
                <div className="text-xs text-muted-foreground mt-1">
                  {currentAgent}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-1">
              {navigationItems.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </nav>

          {/* Recent Sessions */}
          {!collapsed && sessions.length > 0 && (
            <div className="p-4 border-t border-border">
              <div className="text-sm font-medium mb-2">Recent Sessions</div>
              <div className="space-y-1">
                {sessions.slice(-3).map((session) => (
                  <button
                    key={session.id}
                    className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <div className="truncate">{session.name}</div>
                    <div className="text-xs opacity-60">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
