import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  Cpu, 
  HardDrive, 
  Clock,
  Zap
} from 'lucide-react';
import { useAgentStore } from '../../stores/agent-store';
import { useSettingsStore } from '../../stores/settings-store';
import { formatDuration } from '../../lib/utils';

export function StatusBar() {
  const { currentSession, messages } = useAgentStore();
  const { modelSettings, operatorSettings } = useSettingsStore();

  // Mock system stats - in a real app these would come from the main process
  const [systemStats] = React.useState({
    connected: true,
    cpuUsage: 15,
    memoryUsage: 45,
    uptime: Date.now() - 3600000 // 1 hour ago
  });

  const getConnectionStatus = () => {
    return systemStats.connected ? (
      <div className="flex items-center gap-1 text-green-600">
        <Wifi className="h-3 w-3" />
        <span className="text-xs">Connected</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-red-600">
        <WifiOff className="h-3 w-3" />
        <span className="text-xs">Disconnected</span>
      </div>
    );
  };

  const getModelInfo = () => {
    if (!modelSettings.provider) return null;
    
    return (
      <div className="flex items-center gap-1">
        <Zap className="h-3 w-3" />
        <span className="text-xs">
          {modelSettings.provider === 'openai' && 'OpenAI'}
          {modelSettings.provider === 'anthropic' && 'Anthropic'}
          {modelSettings.provider === 'custom' && 'OpenRouter'}
          {modelSettings.provider === 'local' && 'Local'}
        </span>
      </div>
    );
  };

  const getOperatorInfo = () => {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs">
          {operatorSettings.type === 'local_computer' && '🖥️ Desktop'}
          {operatorSettings.type === 'web_browser' && '🌐 Browser'}
          {operatorSettings.type === 'hybrid' && '🔄 Hybrid'}
        </span>
      </div>
    );
  };

  const getSessionInfo = () => {
    if (!currentSession) return null;
    
    return (
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span className="text-xs">
          {messages.length} messages
        </span>
      </div>
    );
  };

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-muted/50 border-t border-border text-muted-foreground">
      {/* Left side - Connection and system status */}
      <div className="flex items-center gap-4">
        {getConnectionStatus()}
        
        <div className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          <span className="text-xs">CPU: {systemStats.cpuUsage}%</span>
        </div>
        
        <div className="flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          <span className="text-xs">RAM: {systemStats.memoryUsage}%</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className="text-xs">
            Uptime: {formatDuration(Date.now() - systemStats.uptime)}
          </span>
        </div>
      </div>

      {/* Center - Agent status */}
      <div className="flex items-center gap-4">
        {getModelInfo()}
        {getOperatorInfo()}
        {getSessionInfo()}
      </div>

      {/* Right side - Version and additional info */}
      <div className="flex items-center gap-4">
        <span className="text-xs">Robin Assistant v0.1.0</span>
        <span className="text-xs">
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
