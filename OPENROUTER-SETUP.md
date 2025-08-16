# 🌐 OpenRouter Integration Guide

## What is OpenRouter?

OpenRouter is a unified API that provides access to multiple AI models from different providers through a single interface. This allows you to:

- **Access Multiple Models**: Use Claude, GPT-4, Llama, Mixtral, and more through one API
- **Cost Optimization**: Compare prices and choose the most cost-effective model for your task
- **Fallback Options**: Automatically switch to alternative models if your primary choice is unavailable
- **Unified Billing**: Pay for all models through one account

## 🚀 Quick Setup

### 1. Get Your OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai)
2. Sign up for an account
3. Go to [Keys](https://openrouter.ai/keys) section
4. Create a new API key
5. Copy your key (starts with `sk-or-...`)

### 2. Configure in Robin Assistant

#### **Via Web Interface:**
1. Open Robin Assistant
2. Go to Settings → Models tab
3. Find the "OpenRouter" section
4. **Models will load automatically** (100+ models including free ones!)
5. Use the **"Free only"** toggle to see just the free models
6. Enter your API key
7. Select your preferred model (free models are marked with "FREE" badge)
8. Click "Test" to verify connection
9. Click "Refresh Models" to update the model list

#### **Via Environment Variable:**
```bash
# Add to your .env file
OPENROUTER_API_KEY=sk-or-your-key-here
```

#### **Via Desktop App:**
1. Open Robin Assistant desktop app
2. Press Cmd/Ctrl + , for settings
3. Navigate to Agent → Model Configuration
4. Select "OpenRouter" as provider
5. Enter your API key and test connection

## 🎯 Recommended Models

### **🆓 FREE Models (Perfect for Testing)**
```
meta-llama/llama-3.1-8b-instruct:free     # Great general purpose model
microsoft/wizardlm-2-8x22b:free           # Excellent for complex tasks
google/gemma-7b-it:free                    # Good for basic automation
mistralai/mistral-7b-instruct:free         # Fast and efficient
openchat/openchat-7b:free                  # Good conversation model
```

### **💎 Premium Models (Best Performance)**

#### **For GUI Automation (Vision Tasks)**
```
anthropic/claude-3.5-sonnet               # Best for complex reasoning + vision
openai/gpt-4-vision-preview               # Excellent vision capabilities
google/gemini-pro-vision                  # Good balance of speed/quality
anthropic/claude-3-opus                   # Highest quality reasoning
```

#### **For General Tasks**
```
anthropic/claude-3.5-sonnet               # Best overall model
openai/gpt-4-turbo-preview                # Fast and capable
mistralai/mixtral-8x7b-instruct           # Cost-effective alternative
cohere/command-r-plus                     # Great for structured tasks
```

#### **For Code Tasks**
```
anthropic/claude-3.5-sonnet               # Best for coding
openai/gpt-4-turbo-preview                # Strong code understanding
meta-llama/codellama-70b-instruct         # Specialized for code
deepseek/deepseek-coder-33b-instruct      # Excellent code model
```

## 🆕 New Features

### **🔄 Dynamic Model Loading**
- **Automatic Model Discovery**: Robin Assistant now fetches all available models from OpenRouter in real-time
- **Live Model Count**: See exactly how many models are available (usually 100+)
- **Free Model Detection**: Automatically identifies and highlights free models
- **Model Information**: View pricing, capabilities, and descriptions for each model

### **🎛️ Smart Filtering**
- **Free Only Toggle**: Quickly filter to show only free models
- **Model Categories**: Models are sorted by price (free first, then by cost)
- **Visual Indicators**:
  - 🟢 **FREE** badge for zero-cost models
  - 🔵 **VISION** badge for multimodal models
  - 💰 Price per 1K tokens displayed

### **📊 Enhanced Model Selection**
- **Rich Model Cards**: Each model shows:
  - Model name and ID
  - Pricing information
  - Capabilities (vision, etc.)
  - Brief description
- **Search & Filter**: Easily find the right model for your task
- **Refresh Button**: Update model list to get latest offerings

## 💰 Cost Optimization

### **Model Pricing (per 1M tokens)**
- **🆓 FREE Models**: $0 (Perfect for testing and basic tasks!)
  - Llama 3.1 8B Instruct: FREE
  - WizardLM 2 8x22B: FREE
  - Gemma 7B IT: FREE
  - Mistral 7B Instruct: FREE
- **💎 Premium Models**:
  - Claude 3.5 Sonnet: ~$3-15 (input/output)
  - GPT-4 Vision: ~$10-30 (input/output)
  - Mixtral 8x7B: ~$0.24-0.24 (input/output)
  - Llama 2 70B: ~$0.70-0.80 (input/output)

### **💡 Smart Cost Management**
1. **Start with FREE models**: Test your automation with zero cost
2. **Use the "Free only" filter**: Quickly find all free options
3. **Upgrade strategically**: Move to premium models only when needed
4. **Monitor in real-time**: Robin Assistant shows pricing for each model
5. **Set usage limits**: Configure monthly spending limits in OpenRouter dashboard
6. **Track performance**: Compare free vs premium model results

## 🔧 Advanced Configuration

### **Custom Model Parameters**
```json
{
  "provider": "openrouter",
  "model": "anthropic/claude-3.5-sonnet",
  "temperature": 0.1,
  "max_tokens": 4000,
  "top_p": 0.9,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

### **Fallback Configuration**
```json
{
  "primary": "anthropic/claude-3.5-sonnet",
  "fallbacks": [
    "openai/gpt-4-vision-preview",
    "mistralai/mixtral-8x7b-instruct"
  ]
}
```

## 🧪 Testing Your Setup

### **1. Basic Connection Test**
```bash
# Run the connection test script
node scripts/test-llm-connection.js --interactive

# Select OpenRouter when prompted
# Enter a test prompt like "Hello, can you see this message?"
```

### **2. Vision Test**
```bash
# Test with Robin Assistant
"Take a screenshot and describe what you see"
```

### **3. Automation Test**
```bash
# Test basic automation
"Click on the Chrome icon on my desktop"
```

## 🔍 Troubleshooting

### **Common Issues**

#### **"Invalid API Key" Error**
- Verify your API key starts with `sk-or-`
- Check for extra spaces or characters
- Ensure the key hasn't expired
- Try regenerating the key in OpenRouter dashboard

#### **"Model Not Available" Error**
- Check if the model is currently available on OpenRouter
- Try a different model from the same provider
- Check OpenRouter status page for outages

#### **"Rate Limited" Error**
- You've exceeded your usage limits
- Wait for the rate limit to reset
- Upgrade your OpenRouter plan for higher limits

#### **"Insufficient Credits" Error**
- Add credits to your OpenRouter account
- Check your billing settings
- Set up auto-recharge if needed

### **Debug Steps**
1. **Check API Key**: Verify in OpenRouter dashboard
2. **Test Direct API**: Use curl to test the API directly
3. **Check Logs**: Enable debug logging in Robin Assistant
4. **Try Different Model**: Switch to a known working model

### **Direct API Test**
```bash
curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## 📊 Monitoring Usage

### **OpenRouter Dashboard**
- View real-time usage statistics
- Set spending alerts and limits
- Monitor model performance
- Track cost per request

### **Robin Assistant Logs**
- Enable debug logging to see API calls
- Monitor response times and success rates
- Track which models are being used

## 🔒 Security Best Practices

1. **Keep API Keys Secure**: Never commit keys to version control
2. **Use Environment Variables**: Store keys in .env files
3. **Rotate Keys Regularly**: Generate new keys periodically
4. **Monitor Usage**: Watch for unexpected usage spikes
5. **Set Spending Limits**: Prevent runaway costs

## 🆘 Support

### **OpenRouter Support**
- [OpenRouter Discord](https://discord.gg/openrouter)
- [Documentation](https://openrouter.ai/docs)
- [Status Page](https://status.openrouter.ai)

### **Robin Assistant Support**
- Check the logs for detailed error messages
- Try the built-in connection test
- Refer to the main troubleshooting guide

## 🎉 Success!

Once configured, you should see:
- ✅ "Connected" status in Robin Assistant settings
- 🤖 Successful test responses from your chosen model
- 🎯 Smooth automation with vision-capable AI models

OpenRouter gives you access to the best AI models for GUI automation while providing flexibility in cost and performance optimization!
