import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useSettingsStore } from '../stores/settings-store';
import { 
  Settings as SettingsIcon, 
  Bot, 
  Monitor, 
  Palette, 
  Shield, 
  Download,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface ModelProvider {
  id: string;
  name: string;
  description: string;
  models: string[];
  requiresApiKey: boolean;
  status?: 'connected' | 'disconnected' | 'testing';
  dynamicModels?: boolean;
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  per_request_limits?: {
    prompt_tokens: string;
    completion_tokens: string;
  };
}

const modelProvidersBase: ModelProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet and other Claude models',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    requiresApiKey: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 Vision and other OpenAI models',
    models: ['gpt-4-vision-preview', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
    requiresApiKey: true
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access multiple models through OpenRouter API',
    models: [], // Will be populated dynamically
    requiresApiKey: true,
    dynamicModels: true
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Local models running on your machine',
    models: ['llama2', 'codellama', 'mistral'],
    requiresApiKey: false
  }
];

export default function Settings() {
  const { settings, updateSettings, testConnection, exportSettings, importSettings } = useSettingsStore();
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, 'testing' | 'success' | 'error' | undefined>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>(modelProvidersBase);
  const [showFreeOnly, setShowFreeOnly] = useState<boolean>(false);

  // Fetch OpenRouter models
  const fetchOpenRouterModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      const models: OpenRouterModel[] = data.data || [];

      // Sort models by pricing (free first, then by cost)
      const sortedModels = models.sort((a, b) => {
        const aPrice = parseFloat(a.pricing.prompt) || 0;
        const bPrice = parseFloat(b.pricing.prompt) || 0;

        // Free models first
        if (aPrice === 0 && bPrice !== 0) return -1;
        if (aPrice !== 0 && bPrice === 0) return 1;

        // Then by price
        return aPrice - bPrice;
      });

      setOpenRouterModels(sortedModels);

      // Update the OpenRouter provider with fetched models
      setModelProviders(prev => prev.map(provider => {
        if (provider.id === 'openrouter') {
          return {
            ...provider,
            models: sortedModels.map(model => model.id)
          };
        }
        return provider;
      }));

    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      // Fallback to default models
      setModelProviders(prev => prev.map(provider => {
        if (provider.id === 'openrouter') {
          return {
            ...provider,
            models: [
              'anthropic/claude-3.5-sonnet',
              'openai/gpt-4-vision-preview',
              'meta-llama/llama-3.1-8b-instruct:free',
              'microsoft/wizardlm-2-8x22b:free',
              'google/gemma-7b-it:free'
            ]
          };
        }
        return provider;
      }));
    } finally {
      setLoadingModels(false);
    }
  };

  // Load OpenRouter models on component mount
  useEffect(() => {
    fetchOpenRouterModels();
  }, []);

  const handleSaveSettings = async () => {
    setSaveStatus('saving');
    try {
      await updateSettings(settings);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestResults(prev => ({ ...prev, [providerId]: 'testing' }));
    try {
      const result = await testConnection(providerId);
      setTestResults(prev => ({ ...prev, [providerId]: result ? 'success' : 'error' }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, [providerId]: 'error' }));
    }
    setTimeout(() => {
      setTestResults(prev => ({ ...prev, [providerId]: undefined }));
    }, 3000);
  };

  const toggleApiKeyVisibility = (providerId: string) => {
    setShowApiKey(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const getStatusIcon = (providerId: string) => {
    const status = testResults[providerId];
    switch (status) {
      case 'testing':
        return <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6 sm:w-8 sm:h-8" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Configure Robin Assistant to your preferences</p>
          </div>
        </div>

        <Tabs defaultValue="models" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="grid w-full grid-cols-5 min-w-[600px]">
              <TabsTrigger value="models" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Models</span>
                <span className="sm:hidden">AI</span>
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Monitor className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Agents</span>
                <span className="sm:hidden">Agents</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Palette className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Appearance</span>
                <span className="sm:hidden">UI</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Security</span>
                <span className="sm:hidden">Security</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <SettingsIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Advanced</span>
                <span className="sm:hidden">More</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">AI Model Configuration</CardTitle>
                <CardDescription className="text-sm">
                  Configure the AI models that power Robin Assistant's automation capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6 settings-content custom-scrollbar">
                {modelProviders.map((provider) => (
                  <div key={provider.id} className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm sm:text-base">{provider.name}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">{provider.description}</p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {getStatusIcon(provider.id)}
                        <Badge variant={settings.model?.provider === provider.id ? 'default' : 'secondary'} className="text-xs">
                          {settings.model?.provider === provider.id ? 'Active' : 'Available'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`${provider.id}-model`} className="text-sm">Model</Label>
                          {provider.id === 'openrouter' && openRouterModels.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={showFreeOnly}
                                onCheckedChange={setShowFreeOnly}
                                className="scale-75"
                              />
                              <span className="text-xs text-muted-foreground">Free only</span>
                            </div>
                          )}
                        </div>
                        <Select
                          value={settings.model?.provider === provider.id ? settings.model?.name || '' : ''}
                          onValueChange={(value) => updateSettings({
                            model: { ...settings.model, provider: provider.id as any, name: value }
                          })}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {provider.id === 'openrouter' ? (
                              loadingModels ? (
                                <div className="flex items-center justify-center p-4">
                                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
                                  <span className="text-sm">Loading models...</span>
                                </div>
                              ) : (
                                openRouterModels
                                  .filter(model => !showFreeOnly || parseFloat(model.pricing.prompt) === 0)
                                  .map((model) => {
                                    const isFree = parseFloat(model.pricing.prompt) === 0;
                                    const hasVision = model.architecture.modality === 'multimodal';

                                    return (
                                    <SelectItem key={model.id} value={model.id} className="text-sm">
                                      <div className="flex flex-col w-full">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium">{model.name || model.id}</span>
                                          <div className="flex gap-1">
                                            {isFree && (
                                              <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                                FREE
                                              </span>
                                            )}
                                            {hasVision && (
                                              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                                VISION
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                          <span>{model.id}</span>
                                          {!isFree && (
                                            <span>
                                              ${model.pricing.prompt}/1K tokens
                                            </span>
                                          )}
                                        </div>
                                        {model.description && (
                                          <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {model.description}
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              )
                            ) : (
                              provider.models.map((model) => (
                                <SelectItem key={model} value={model} className="text-sm">
                                  <div className="flex flex-col">
                                    <span>{model}</span>
                                    {model.includes('vision') && (
                                      <span className="text-xs text-muted-foreground">Vision capable</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {provider.requiresApiKey && (
                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-api-key`} className="text-sm">API Key</Label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`${provider.id}-api-key`}
                                type={showApiKey[provider.id] ? 'text' : 'password'}
                                placeholder="Enter your API key"
                                value={settings.apiKeys?.[provider.id] || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({
                                  apiKeys: { ...settings.apiKeys, [provider.id]: e.target.value }
                                })}
                                className="text-sm pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => toggleApiKeyVisibility(provider.id)}
                              >
                                {showApiKey[provider.id] ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
                              </Button>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestConnection(provider.id)}
                              disabled={!settings.apiKeys?.[provider.id] || testResults[provider.id] === 'testing'}
                              className="text-xs sm:text-sm whitespace-nowrap"
                            >
                              <TestTube className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              Test
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>

                  {provider.id === 'ollama' && (
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Make sure Ollama is running locally on port 11434.
                        <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                          Download Ollama
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}

                  {provider.id === 'openrouter' && (
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            OpenRouter provides access to {openRouterModels.length > 0 ? openRouterModels.length : '100+'} AI models
                            {openRouterModels.length > 0 && (
                              <>
                                , including <strong>{openRouterModels.filter(m => parseFloat(m.pricing.prompt) === 0).length} free models</strong>
                              </>
                            )}.
                            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                              Get your API key
                            </a>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchOpenRouterModels}
                            disabled={loadingModels}
                            className="text-xs whitespace-nowrap"
                          >
                            {loadingModels ? (
                              <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full mr-1" />
                            ) : (
                              <Download className="w-3 h-3 mr-1" />
                            )}
                            Refresh Models
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Agent Configuration</CardTitle>
                <CardDescription className="text-sm">
                  Configure how Robin Assistant agents behave and interact with your system
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6 settings-content custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-iterations">Max Iterations</Label>
                    <Input
                      id="max-iterations"
                      type="number"
                      min="1"
                      max="50"
                      value={settings.agent?.maxIterations || 10}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({
                        agent: { ...settings.agent, maxIterations: parseInt(e.target.value) }
                      })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Maximum number of actions an agent can take for a single task
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="iteration-delay">Iteration Delay (ms)</Label>
                    <Input
                      id="iteration-delay"
                      type="number"
                      min="0"
                      max="10000"
                      value={settings.agent?.iterationDelay || 1000}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({
                        agent: { ...settings.agent, iterationDelay: parseInt(e.target.value) }
                      })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Delay between actions in milliseconds
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Screenshot</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically take screenshots during execution
                      </p>
                    </div>
                    <Switch
                      checked={settings.agent?.autoScreenshot ?? true}
                      onCheckedChange={(checked) => updateSettings({
                        agent: { ...settings.agent, autoScreenshot: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Confirm Actions</Label>
                      <p className="text-sm text-muted-foreground">
                        Ask for confirmation before executing actions
                      </p>
                    </div>
                    <Switch
                      checked={settings.agent?.confirmActions ?? false}
                      onCheckedChange={(checked) => updateSettings({
                        agent: { ...settings.agent, confirmActions: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Debug Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable detailed logging and debugging
                      </p>
                    </div>
                    <Switch
                      checked={settings.agent?.debugMode ?? false}
                      onCheckedChange={(checked) => updateSettings({
                        agent: { ...settings.agent, debugMode: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of Robin Assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={settings.appearance?.theme || 'system'}
                      onValueChange={(value: 'light' | 'dark' | 'system') => updateSettings({
                        appearance: { ...settings.appearance, theme: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={settings.appearance?.language || 'en'}
                      onValueChange={(value) => updateSettings({
                        appearance: { ...settings.appearance, language: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Animations</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable smooth animations and transitions
                      </p>
                    </div>
                    <Switch
                      checked={settings.appearance?.animations ?? true}
                      onCheckedChange={(checked) => updateSettings({
                        appearance: { ...settings.appearance, animations: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Use a more compact interface layout
                      </p>
                    </div>
                    <Switch
                      checked={settings.appearance?.compactMode ?? false}
                      onCheckedChange={(checked) => updateSettings({
                        appearance: { ...settings.appearance, compactMode: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security & Privacy</CardTitle>
              <CardDescription>
                Manage your security settings and data privacy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Encrypt Local Data</Label>
                    <p className="text-sm text-muted-foreground">
                      Encrypt sensitive data stored locally
                    </p>
                  </div>
                  <Switch
                    checked={settings.security?.encryptLocalData ?? true}
                    onCheckedChange={(checked) => updateSettings({
                      security: { ...settings.security, encryptLocalData: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-lock</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically lock the application when idle
                    </p>
                  </div>
                  <Switch
                    checked={settings.security?.autoLock ?? false}
                    onCheckedChange={(checked) => updateSettings({
                      security: { ...settings.security, autoLock: checked }
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Telemetry</Label>
                    <p className="text-sm text-muted-foreground">
                      Share anonymous usage data to help improve Robin Assistant
                    </p>
                  </div>
                  <Switch
                    checked={settings.security?.telemetry ?? false}
                    onCheckedChange={(checked) => updateSettings({
                      security: { ...settings.security, telemetry: checked }
                    })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data Management</h3>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={exportSettings}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Settings
                  </Button>
                  <Button variant="outline" onClick={() => document.getElementById('import-file')?.click()}>
                    <Download className="w-4 h-4 mr-2" />
                    Import Settings
                  </Button>
                  <input
                    id="import-file"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          try {
                            const settings = JSON.parse(e.target?.result as string);
                            importSettings(settings);
                          } catch (error) {
                            console.error('Failed to import settings:', error);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Advanced configuration options for power users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="log-level">Log Level</Label>
                    <Select
                      value={settings.advanced?.logLevel || 'info'}
                      onValueChange={(value: 'error' | 'warn' | 'info' | 'debug') => updateSettings({
                        advanced: { ...settings.advanced, logLevel: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="concurrent-agents">Max Concurrent Agents</Label>
                    <Input
                      id="concurrent-agents"
                      type="number"
                      min="1"
                      max="10"
                      value={settings.advanced?.maxConcurrentAgents || 3}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({
                        advanced: { ...settings.advanced, maxConcurrentAgents: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Developer Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable developer tools and advanced features
                      </p>
                    </div>
                    <Switch
                      checked={settings.advanced?.developerMode ?? false}
                      onCheckedChange={(checked) => updateSettings({
                        advanced: { ...settings.advanced, developerMode: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Experimental Features</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable experimental and beta features
                      </p>
                    </div>
                    <Switch
                      checked={settings.advanced?.experimentalFeatures ?? false}
                      onCheckedChange={(checked) => updateSettings({
                        advanced: { ...settings.advanced, experimentalFeatures: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={saveStatus === 'saving'}
            className="min-w-[120px] text-sm"
          >
            {saveStatus === 'saving' && <div className="animate-spin w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full mr-2" />}
            {saveStatus === 'saved' && <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />}
            {saveStatus === 'error' && <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />}
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
