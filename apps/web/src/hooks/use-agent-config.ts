import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settings-store';
import { useAgentStore } from '../stores/agent-store';

export function useAgentConfig() {
  const { settings, getWebAgentConfig } = useSettingsStore();
  const { setAgentConfig, agentConfig } = useAgentStore();

  useEffect(() => {
    // Auto-configure agent when settings change
    const newConfig = getWebAgentConfig();
    
    // Only update if configuration has actually changed
    if (!agentConfig || JSON.stringify(agentConfig) !== JSON.stringify(newConfig)) {
      console.log('Updating agent configuration:', newConfig);
      setAgentConfig(newConfig);
    }
  }, [settings, getWebAgentConfig, setAgentConfig, agentConfig]);

  return {
    agentConfig,
    isConfigured: !!(
      agentConfig?.model?.apiKey && 
      agentConfig?.model?.provider && 
      agentConfig?.model?.name
    )
  };
}
