
import { useNavigate } from 'react-router-dom';
import {
  Monitor,
  Globe,
  Layers,
  MessageSquare,
  Settings,
  Activity,
  Clock,
  Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAgentStore, AgentStatus } from '../stores/agent-store';
import { useSettingsStore } from '../stores/settings-store';
import { cn, formatTimestamp } from '../lib/utils';

export function Dashboard() {
  const navigate = useNavigate();
  const {
    agentStatus,
    currentSession,
    sessions,
    createSession
  } = useAgentStore();
  const { modelSettings, operatorSettings } = useSettingsStore();

  const quickActions = [
    {
      title: 'Local Computer Control',
      description: 'Automate desktop applications and system tasks',
      icon: Monitor,
      path: '/local',
      color: 'bg-blue-500'
    },
    {
      title: 'Web Browser Automation',
      description: 'Control web browsers and automate web tasks',
      icon: Globe,
      path: '/browser',
      color: 'bg-green-500'
    },
    {
      title: 'Hybrid Agent Mode',
      description: 'Combined desktop and web automation',
      icon: Layers,
      path: '/hybrid',
      color: 'bg-purple-500'
    },
    {
      title: 'Interactive Chat',
      description: 'Chat with the agent for complex tasks',
      icon: MessageSquare,
      path: '/chat',
      color: 'bg-orange-500'
    }
  ];

  const handleQuickStart = (path: string) => {
    if (!currentSession) {
      createSession();
    }
    navigate(path);
  };

  const getStatusCard = () => {
    const statusConfig = {
      [AgentStatus.IDLE]: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Ready' },
      [AgentStatus.RUNNING]: { color: 'text-green-600', bg: 'bg-green-100', label: 'Active' },
      [AgentStatus.PAUSED]: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Paused' },
      [AgentStatus.ERROR]: { color: 'text-red-600', bg: 'bg-red-100', label: 'Error' },
      [AgentStatus.INITIALIZING]: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Starting' },
      [AgentStatus.STOPPED]: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Stopped' }
    };

    const config = statusConfig[agentStatus] || statusConfig[AgentStatus.IDLE];

    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Agent Status</h3>
          <div className={cn("px-3 py-1 rounded-full text-sm font-medium", config.bg, config.color)}>
            {config.label}
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Model Provider</span>
            <span className="text-sm font-medium capitalize">
              {modelSettings.provider || 'Not configured'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Operator Type</span>
            <span className="text-sm font-medium">
              {operatorSettings.type === 'local_computer' && 'Desktop'}
              {operatorSettings.type === 'web_browser' && 'Browser'}
              {operatorSettings.type === 'hybrid' && 'Hybrid'}
            </span>
          </div>
          
          {currentSession && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Session</span>
              <span className="text-sm font-medium truncate max-w-32">
                {currentSession.name}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getRecentActivity = () => {
    const recentSessions = sessions.slice(-5).reverse();
    
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/history')}
          >
            View All
          </Button>
        </div>
        
        {recentSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div 
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate('/history')}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{session.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {session.messages.length} messages
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTimestamp(session.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getQuickStats = () => {
    const totalMessages = sessions.reduce((acc, session) => acc + session.messages.length, 0);
    const totalSessions = sessions.length;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalMessages}</div>
              <div className="text-sm text-muted-foreground">Total Messages</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalSessions}</div>
              <div className="text-sm text-muted-foreground">Sessions</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{agentStatus === AgentStatus.RUNNING ? '1' : '0'}</div>
              <div className="text-sm text-muted-foreground">Active Agents</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to Robin Assistant</h1>
        <p className="text-muted-foreground">
          Your AI-powered automation companion for desktop and web tasks
        </p>
      </div>

      {/* Quick Stats */}
      {getQuickStats()}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Status Card */}
        <div className="lg:col-span-1">
          {getStatusCard()}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          {getRecentActivity()}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <div
              key={action.path}
              className="bg-card rounded-lg border border-border p-6 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handleQuickStart(action.path)}
            >
              <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4", action.color)}>
                <action.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {action.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Check */}
      {(!modelSettings.apiKey || !modelSettings.provider) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800">Configuration Required</h3>
              <p className="text-sm text-yellow-700">
                Please configure your AI model settings to start using Robin Assistant.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/settings')}
            >
              Configure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
