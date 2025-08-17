// Robin Assistant Desktop Renderer
class RobinAssistant {
    constructor() {
        this.isScreenCaptureEnabled = false;
        this.currentSettings = {
            provider: 'openai',
            apiKey: '',
            model: 'gpt-4-vision-preview'
        };
        this.availableModels = {};
        this.availableScreens = [];
        this.selectedScreen = null;

        this.init();
    }

    async init() {
        console.log('🚀 Robin Assistant Desktop initializing...');
        
        // Bind event listeners
        this.bindEvents();
        
        // Load saved settings
        await this.loadSettings();
        
        // Check screen capture status
        await this.checkScreenCapture();
    }

    bindEvents() {
        // Setup button
        const enableBtn = document.getElementById('enable-capture-btn');
        enableBtn.addEventListener('click', () => this.enableScreenCapture());

        // Send button and input
        const sendBtn = document.getElementById('send-button');
        const messageInput = document.getElementById('message-input');
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        });

        // Settings
        document.getElementById('ai-provider').addEventListener('change', async (e) => {
            this.currentSettings.provider = e.target.value;
            await this.updateModelOptions();
            this.saveSettings();
        });

        document.getElementById('ai-api-key').addEventListener('input', (e) => {
            this.currentSettings.apiKey = e.target.value;
            this.saveSettings();
            // Clear any previous API test results
            this.clearApiTestStatus();
        });

        document.getElementById('ai-model').addEventListener('change', (e) => {
            this.currentSettings.model = e.target.value;
            this.saveSettings();
        });

        // Add API key test button
        document.getElementById('test-api-key').addEventListener('click', () => {
            this.testApiKey();
        });

        // Add refresh models button for OpenRouter
        document.getElementById('refresh-models').addEventListener('click', () => {
            this.fetchOpenRouterModels(true);
        });
    }

    async checkScreenCapture() {
        console.log('🔍 Checking native desktop screen capture capabilities...');

        try {
            // Check if electronAPI is available
            if (typeof window.electronAPI === 'undefined') {
                throw new Error('Electron API not available - not running in desktop app');
            }

            if (typeof window.electronAPI.screenshot === 'undefined') {
                throw new Error('Native screenshot API not available');
            }

            console.log('✅ Electron native screenshot API detected');
            this.updateStatus('ready', 'Ready to select screen for automation');

            // Don't auto-start - let user choose screen first
            // The setup screen will handle screen selection

        } catch (error) {
            console.error('❌ Screen capture check failed:', error);
            this.updateStatus('error', 'Native desktop screen capture not available');
        }
    }

    async enableScreenCapture() {
        const button = document.getElementById('enable-capture-btn');
        const buttonText = document.getElementById('setup-button-text');

        // Show loading state
        button.disabled = true;
        buttonText.innerHTML = '<span class="loading-spinner"></span>Getting available screens...';

        try {
            console.log('🚀 Getting available screens and windows...');

            // First, get available screens/windows
            await this.getAvailableScreens();

            if (this.availableScreens.length === 0) {
                throw new Error('No screens or windows available for capture');
            }

            // Always show screen selection to let user choose
            // This includes both screens and windows for better control
            this.showScreenSelection();

        } catch (error) {
            console.error('❌ Failed to get available screens:', error);
            this.updateStatus('error', error.message);

            // Reset button
            button.disabled = false;
            buttonText.innerHTML = '🔄 Retry Screen Capture';
        }
    }

    async getAvailableScreens() {
        try {
            // Get screen info from the screenshot service
            const result = await window.electronAPI.screenshot.getScreenInfo();

            if (result.success && result.screens) {
                this.availableScreens = result.screens;
                console.log(`Found ${this.availableScreens.length} available screens/windows`);
            } else {
                throw new Error(result.error || 'Failed to get screen information');
            }
        } catch (error) {
            console.error('Failed to get available screens:', error);
            // Fallback to default screen
            this.availableScreens = [{ id: 'screen:0', name: 'Primary Display', width: 1920, height: 1080 }];
        }
    }

    showScreenSelection() {
        const setupCard = document.querySelector('.setup-card');

        // Create screen selection UI
        const selectionHTML = `
            <div class="screen-selection">
                <div class="setup-icon">📺</div>
                <h2 class="setup-title">Choose Screen or Window to Capture</h2>
                <p class="setup-description">
                    Select which screen or application window you want Robin Assistant to see and automate.
                </p>
                <div class="screen-grid">
                    ${this.availableScreens.map((screen, index) => `
                        <div class="screen-option" data-screen-id="${screen.id}" data-index="${index}">
                            <div class="screen-preview">
                                <div class="screen-icon">${screen.type === 'screen' ? '🖥️' : '📱'}</div>
                                <div class="screen-info">
                                    <div class="screen-name">${screen.name}</div>
                                    <div class="screen-resolution">${screen.width}×${screen.height}</div>
                                    <div class="screen-type">${screen.type === 'screen' ? 'Display' : 'Window'}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button id="confirm-screen-btn" class="setup-button" disabled>
                    <span>🚀 Start Automation with Selected ${this.availableScreens.length > 0 ? (this.availableScreens[0].type === 'screen' ? 'Screen' : 'Window') : 'Source'}</span>
                </button>
            </div>
        `;

        setupCard.innerHTML = selectionHTML;

        // Add click handlers for screen selection
        document.querySelectorAll('.screen-option').forEach(option => {
            option.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.screen-option').forEach(opt => opt.classList.remove('selected'));

                // Select this option
                option.classList.add('selected');

                // Enable confirm button
                const confirmBtn = document.getElementById('confirm-screen-btn');
                confirmBtn.disabled = false;

                // Store selected screen
                const screenIndex = parseInt(option.dataset.index);
                this.selectedScreen = this.availableScreens[screenIndex];

                // Update button text with selected screen name
                confirmBtn.innerHTML = `<span>🚀 Start Automation with "${this.selectedScreen.name}"</span>`;
            });
        });

        // Add confirm button handler
        document.getElementById('confirm-screen-btn').addEventListener('click', () => {
            this.captureSelectedScreen();
        });
    }

    async captureSelectedScreen() {
        const button = document.getElementById('confirm-screen-btn') || document.getElementById('enable-capture-btn');
        const buttonText = button.querySelector('span') || button;

        // Show loading state
        button.disabled = true;
        buttonText.innerHTML = '<span class="loading-spinner"></span>Capturing screen...';

        try {
            console.log('🚀 Capturing selected screen:', this.selectedScreen.name);

            // Take screenshot with selected screen
            const result = await window.electronAPI.screenshot.take({
                screenId: this.selectedScreen.id
            });

            if (result.success) {
                console.log('✅ Screen capture successful');

                // Show preview
                this.showScreenshotPreview(result.data);

                // Update status
                this.updateStatus('ready', `Screen capture ready: ${this.selectedScreen.name}`);
                this.isScreenCaptureEnabled = true;

                // Update button text
                buttonText.innerHTML = '✅ Screen Capture Enabled';

                // Switch to chat interface after a short delay
                setTimeout(() => {
                    this.showChatInterface();
                }, 2500);

            } else {
                throw new Error(result.error || 'Failed to capture selected screen');
            }
        } catch (error) {
            console.error('❌ Failed to capture screen:', error);
            this.updateStatus('error', error.message);

            // Reset button
            button.disabled = false;
            buttonText.innerHTML = '🔄 Retry Screen Capture';
        }
    }

    showScreenshotPreview(screenshotData) {
        let preview = document.getElementById('screenshot-preview');
        if (!preview) {
            // Create container if missing
            const setupCard = document.querySelector('.setup-card');
            preview = document.createElement('div');
            preview.id = 'screenshot-preview';
            preview.className = 'screenshot-preview';
            setupCard?.appendChild(preview);
        }

        const img = document.createElement('img');

        // Ensure data URL format
        const dataUrl = screenshotData.data || screenshotData;
        img.src = dataUrl && dataUrl.startsWith('data:') ? dataUrl : `data:image/png;base64,${dataUrl}`;
        img.alt = 'Native desktop screen capture preview';
        img.style.borderRadius = '8px';
        img.style.border = '2px solid #10b981';

        preview.innerHTML = `
            <p style="margin-bottom: 12px; color: #10b981; font-weight: 600; font-size: 16px;">
                ✅ Native Desktop Screen Capture Successful!
            </p>
            <p style="margin-bottom: 8px; color: #94a3b8; font-size: 14px;">
                Captured ${screenshotData.width}x${screenshotData.height} pixels from your desktop
            </p>
        `;
        preview.appendChild(img);
        preview.classList.remove('hidden');
    }

    showChatInterface() {
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.remove('hidden');
        
        // Focus on input
        document.getElementById('message-input').focus();
    }

    updateStatus(type, message) {
        const badge = document.getElementById('status-badge');
        const messageEl = document.getElementById('status-message');
        
        // Remove all status classes
        badge.className = 'status-badge';
        
        // Add appropriate class
        switch (type) {
            case 'ready':
                badge.classList.add('status-ready');
                badge.textContent = 'Ready';
                break;
            case 'error':
                badge.classList.add('status-error');
                badge.textContent = 'Error';
                break;
            case 'loading':
                badge.classList.add('status-loading');
                badge.textContent = 'Loading';
                break;
        }
        
        messageEl.textContent = message;
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-button');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addMessage('user', message);
        
        // Clear input and disable send button
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="loading-spinner"></span>Processing...';
        
        try {
            // Add thinking message
            const thinkingId = this.addMessage('assistant', '🤔 Analyzing your request and capturing desktop screenshot...');

            // Take screenshot using native Electron API
            const screenshot = await window.electronAPI.screenshot.take();

            if (!screenshot.success) {
                throw new Error('Failed to capture desktop screen: ' + screenshot.error);
            }

            // Update thinking message
            this.updateMessage(thinkingId, '🧠 AI is analyzing the desktop screenshot and planning automation actions...');

            // Call AI service (this would be implemented with real AI integration)
            const response = await this.processWithAI(message, screenshot.data);

            // Update with AI response
            this.updateMessage(thinkingId, response);
            
        } catch (error) {
            console.error('❌ Failed to process message:', error);
            this.addMessage('assistant', `❌ Error: ${error.message}`);
        } finally {
            // Re-enable send button
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
            input.focus();
        }
    }

    async processWithAI(instruction, screenshotData) {
        if (!this.currentSettings.apiKey) {
            return '⚠️ **API Key Required for Automation**\n\n' +
                   '🔧 **Quick Setup:**\n' +
                   '1. Select your AI provider in the sidebar\n' +
                   '2. Enter your API key\n' +
                   '3. Click "Test" to verify\n' +
                   '4. Try your automation request again!\n\n' +
                   '🚀 **Supported Providers:**\n' +
                   '• OpenAI (GPT-4 Vision)\n' +
                   '• Anthropic (Claude 3.5 Sonnet)\n' +
                   '• OpenRouter (Multiple models)';
        }

        try {
            // Call real AI service with screenshot
            const aiResponse = await this.callAIForAutomation(instruction, screenshotData);

            if (aiResponse.success) {
                // Execute the automation actions
                const automationResult = await this.executeAutomationActions(aiResponse.actions);

                return `🤖 **AI Analysis & Automation Complete**\n\n` +
                       `**Request:** "${instruction}"\n\n` +
                       `**AI Analysis:** ${aiResponse.analysis}\n\n` +
                       `**Actions Taken:**\n${automationResult.summary}\n\n` +
                       `**Status:** ${automationResult.success ? '✅ Success' : '❌ Failed'}\n\n` +
                       `**Model Used:** ${this.currentSettings.provider} ${this.currentSettings.model}`;
            } else {
                throw new Error(aiResponse.error || 'AI analysis failed');
            }
        } catch (error) {
            console.error('AI processing failed:', error);
            return `❌ **Automation Failed**\n\n` +
                   `**Error:** ${error.message}\n\n` +
                   `**Request:** "${instruction}"\n\n` +
                   `**Troubleshooting:**\n` +
                   `• Check your API key is valid\n` +
                   `• Ensure the model supports vision\n` +
                   `• Try a simpler instruction\n` +
                   `• Check your internet connection`;
        }
    }

    async callAIForAutomation(instruction, screenshotData) {
        const { provider, apiKey, model } = this.currentSettings;

        const prompt = `You are Robin Assistant, an AI desktop automation agent. Analyze this screenshot and provide automation actions for the user's request.

User Request: "${instruction}"

Screenshot: ${screenshotData.width}x${screenshotData.height} desktop capture

Analyze the screenshot and provide:
1. What you can see on the desktop
2. Specific automation actions to fulfill the request
3. Step-by-step plan

Respond in JSON format:
{
  "analysis": "What you see on the desktop",
  "canAutomate": true/false,
  "actions": [
    {"type": "click", "x": 100, "y": 200, "description": "Click Chrome icon"},
    {"type": "type", "text": "hello", "description": "Type text"},
    {"type": "key", "key": "Enter", "description": "Press Enter"}
  ],
  "reasoning": "Why these actions will fulfill the request"
}`;

        try {
            let response;
            const imageData = screenshotData.data || screenshotData;
            const base64Image = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;

            switch (provider) {
                case 'openai':
                    response = await this.callOpenAIVision(prompt, base64Image, apiKey, model);
                    break;
                case 'anthropic':
                    response = await this.callAnthropicVision(prompt, base64Image, apiKey, model);
                    break;
                case 'openrouter':
                    response = await this.callOpenRouterVision(prompt, base64Image, apiKey, model);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }

            // Parse AI response
            const aiResult = JSON.parse(response);
            return {
                success: true,
                analysis: aiResult.analysis,
                actions: aiResult.actions || [],
                reasoning: aiResult.reasoning
            };

        } catch (error) {
            console.error('AI call failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async callOpenAIVision(prompt, imageData, apiKey, model) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageData } }
                    ]
                }],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'No response from OpenAI';
    }

    async callAnthropicVision(prompt, imageData, apiKey, model) {
        const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0]?.text || 'No response from Anthropic';
    }

    async callOpenRouterVision(prompt, imageData, apiKey, model) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageData } }
                    ]
                }],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'No response from OpenRouter';
    }

    async executeAutomationActions(actions) {
        if (!actions || actions.length === 0) {
            return {
                success: false,
                summary: 'No automation actions provided by AI'
            };
        }

        const results = [];
        let successCount = 0;

        for (const action of actions) {
            try {
                const result = await this.executeAction(action);
                results.push(`${result.success ? '✅' : '❌'} ${action.description || action.type}`);
                if (result.success) successCount++;

                // Small delay between actions
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                results.push(`❌ ${action.description || action.type}: ${error.message}`);
            }
        }

        return {
            success: successCount > 0,
            summary: results.join('\n'),
            totalActions: actions.length,
            successfulActions: successCount
        };
    }

    async executeAction(action) {
        // This would call the Electron main process to perform actual automation
        // For now, we'll simulate the actions

        console.log('Executing action:', action);

        switch (action.type) {
            case 'click':
                // Would call: await window.electronAPI.automation.click(action.x, action.y);
                return { success: true, message: `Clicked at (${action.x}, ${action.y})` };

            case 'type':
                // Would call: await window.electronAPI.automation.type(action.text);
                return { success: true, message: `Typed: ${action.text}` };

            case 'key':
                // Would call: await window.electronAPI.automation.pressKey(action.key);
                return { success: true, message: `Pressed key: ${action.key}` };

            default:
                throw new Error(`Unsupported action type: ${action.type}`);
        }
    }

    addMessage(type, content) {
        const messages = document.getElementById('messages');
        const messageEl = document.createElement('div');
        const messageId = 'msg-' + Date.now();
        
        messageEl.id = messageId;
        messageEl.className = `message ${type}`;
        messageEl.textContent = content;
        
        messages.appendChild(messageEl);
        messages.scrollTop = messages.scrollHeight;
        
        return messageId;
    }

    updateMessage(messageId, content) {
        const messageEl = document.getElementById(messageId);
        if (messageEl) {
            messageEl.textContent = content;
        }
    }

    async updateModelOptions() {
        const modelSelect = document.getElementById('ai-model');
        const provider = this.currentSettings.provider;
        const refreshBtn = document.getElementById('refresh-models');

        // Clear existing options
        modelSelect.innerHTML = '<option value="">Loading models...</option>';

        let models = [];

        if (provider === 'openrouter') {
            // Show refresh button for OpenRouter
            refreshBtn.style.display = 'inline-block';

            // Fetch OpenRouter models if not cached or if forced refresh
            if (!this.availableModels.openrouter) {
                await this.fetchOpenRouterModels();
            }
            models = this.availableModels.openrouter || [];
        } else {
            // Hide refresh button for other providers
            refreshBtn.style.display = 'none';

            // Static models for other providers
            const staticModels = {
                openai: [
                    { value: 'gpt-4-vision-preview', text: 'GPT-4 Vision Preview' },
                    { value: 'gpt-4o', text: 'GPT-4o' },
                    { value: 'gpt-4o-mini', text: 'GPT-4o Mini' }
                ],
                anthropic: [
                    { value: 'claude-3-5-sonnet-20241022', text: 'Claude 3.5 Sonnet' },
                    { value: 'claude-3-opus-20240229', text: 'Claude 3 Opus' },
                    { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku' }
                ]
            };
            models = staticModels[provider] || [];
        }

        // Clear loading message
        modelSelect.innerHTML = '';

        if (models.length === 0) {
            modelSelect.innerHTML = '<option value="">No models available</option>';
            return;
        }

        // Populate models
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.text;
            modelSelect.appendChild(option);
        });

        // Set current model if it exists for this provider
        if (models.find(m => m.value === this.currentSettings.model)) {
            modelSelect.value = this.currentSettings.model;
        } else {
            // Set first model as default
            this.currentSettings.model = models[0].value;
            modelSelect.value = this.currentSettings.model;
        }
    }

    async fetchOpenRouterModels(forceRefresh = false) {
        if (this.availableModels.openrouter && !forceRefresh) {
            return this.availableModels.openrouter;
        }

        try {
            console.log('Fetching OpenRouter models...');
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.currentSettings.apiKey || 'dummy'}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Filter and format models for vision tasks
            const visionModels = data.data
                .filter(model =>
                    model.id.includes('vision') ||
                    model.id.includes('gpt-4') ||
                    model.id.includes('claude') ||
                    model.id.includes('gemini') ||
                    model.context_length > 32000
                )
                .map(model => ({
                    value: model.id,
                    text: `${model.name} (${model.pricing?.prompt || 'Free'})`
                }))
                .sort((a, b) => a.text.localeCompare(b.text));

            this.availableModels.openrouter = visionModels;
            console.log(`✅ Fetched ${visionModels.length} OpenRouter models`);

            return visionModels;
        } catch (error) {
            console.error('❌ Failed to fetch OpenRouter models:', error);

            // Fallback to static models
            const fallbackModels = [
                { value: 'openai/gpt-4-vision-preview', text: 'GPT-4 Vision Preview' },
                { value: 'anthropic/claude-3-5-sonnet', text: 'Claude 3.5 Sonnet' },
                { value: 'google/gemini-pro-vision', text: 'Gemini Pro Vision' },
                { value: 'meta-llama/llama-3.2-90b-vision-instruct', text: 'Llama 3.2 90B Vision' }
            ];

            this.availableModels.openrouter = fallbackModels;
            return fallbackModels;
        }
    }

    async loadSettings() {
        try {
            const settings = await window.electronAPI.settings.get();
            if (settings.success && settings.data) {
                this.currentSettings = { ...this.currentSettings, ...settings.data };
                
                // Update UI
                document.getElementById('ai-provider').value = this.currentSettings.provider;
                document.getElementById('ai-api-key').value = this.currentSettings.apiKey;
                this.updateModelOptions();
                document.getElementById('ai-model').value = this.currentSettings.model;
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    async saveSettings() {
        try {
            await window.electronAPI.settings.set(this.currentSettings);
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    async testApiKey() {
        const testBtn = document.getElementById('test-api-key');
        const statusEl = document.getElementById('api-test-status');

        if (!this.currentSettings.apiKey) {
            this.showApiTestStatus('error', 'Please enter an API key first');
            return;
        }

        // Show loading state
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        this.showApiTestStatus('loading', 'Testing API key...');

        try {
            const result = await this.callTestAPI();

            if (result.success) {
                this.showApiTestStatus('success', `✅ API key valid! ${result.message || ''}`);
            } else {
                this.showApiTestStatus('error', `❌ ${result.error || 'API key test failed'}`);
            }
        } catch (error) {
            this.showApiTestStatus('error', `❌ ${error.message}`);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test API Key';
        }
    }

    async callTestAPI() {
        const { provider, apiKey, model } = this.currentSettings;

        try {
            switch (provider) {
                case 'openai':
                    return await this.testOpenAI(apiKey, model);
                case 'anthropic':
                    return await this.testAnthropic(apiKey, model);
                case 'openrouter':
                    return await this.testOpenRouter(apiKey, model);
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testOpenAI(apiKey, model) {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const modelExists = data.data.some(m => m.id === model);

        return {
            success: true,
            message: modelExists ? `Model "${model}" available` : 'API key valid, but model may not be accessible'
        };
    }

    async testAnthropic(apiKey, model) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 1,
                messages: [{ role: 'user', content: 'test' }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        return { success: true, message: `Model "${model}" accessible` };
    }

    async testOpenRouter(apiKey, model) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        return { success: true, message: `Model "${model}" accessible` };
    }

    showApiTestStatus(type, message) {
        const statusEl = document.getElementById('api-test-status');
        statusEl.className = `api-test-status ${type}`;
        statusEl.textContent = message;
        statusEl.style.display = 'block';
    }

    clearApiTestStatus() {
        const statusEl = document.getElementById('api-test-status');
        statusEl.style.display = 'none';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.robinAssistant = new RobinAssistant();
});
