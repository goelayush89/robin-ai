#!/usr/bin/env node

/**
 * Robin Assistant LLM Connection Demo
 * 
 * This script demonstrates how Robin Assistant connects to and uses LLMs
 * for GUI automation tasks.
 */

const { LocalComputerAgent } = require('../packages/core/dist/agents');
const { ModelProvider, OperatorType, AgentStatus } = require('../packages/core/dist/types');

// Demo configuration
const demoConfig = {
  id: 'demo-agent',
  name: 'Demo Local Computer Agent',
  model: {
    provider: ModelProvider.ANTHROPIC, // or ModelProvider.OPENAI
    name: 'claude-3-5-sonnet-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here',
    version: '1.0'
  },
  operator: {
    type: OperatorType.LOCAL_COMPUTER,
    settings: {
      headless: false,
      timeout: 30000
    }
  },
  settings: {
    maxIterations: 5,
    iterationDelay: 2000
  }
};

class LLMConnectionDemo {
  constructor() {
    this.agent = null;
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  async demonstrateConnection() {
    console.log('🚀 Robin Assistant LLM Connection Demo');
    console.log('=====================================\n');

    try {
      // Step 1: Create and initialize agent
      this.log('📝 Step 1: Creating Local Computer Agent...');
      this.agent = new LocalComputerAgent();
      
      this.log('🔧 Step 2: Initializing agent with LLM configuration...');
      await this.agent.initialize(demoConfig);
      
      this.log('✅ Agent initialized successfully!');
      this.log('📊 Model Info:', this.agent.getModelInfo());

      // Step 2: Take a screenshot
      this.log('📸 Step 3: Taking screenshot for analysis...');
      const screenshot = await this.agent.takeScreenshot();
      this.log('✅ Screenshot captured', {
        width: screenshot.width,
        height: screenshot.height,
        timestamp: screenshot.timestamp
      });

      // Step 3: Demonstrate LLM analysis
      this.log('🧠 Step 4: Sending screenshot to LLM for analysis...');
      
      const testInstruction = "Analyze this screenshot and tell me what you see. Identify any clickable elements.";
      
      // Create execution context
      const context = {
        sessionId: 'demo-session',
        screenshot: screenshot,
        previousActions: [],
        environment: {
          platform: process.platform,
          timestamp: Date.now()
        }
      };

      this.log('📤 Sending instruction to LLM:', { instruction: testInstruction });
      
      // This will internally call the LLM
      const results = await this.agent.execute(testInstruction, context);
      
      this.log('📥 LLM Response received!');
      this.log('🎯 Execution Results:', {
        totalActions: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      // Display detailed results
      results.forEach((result, index) => {
        this.log(`📋 Action ${index + 1}:`, {
          success: result.success,
          data: result.data,
          error: result.error
        });
      });

    } catch (error) {
      this.log('❌ Demo failed:', { error: error.message });
      
      // Provide troubleshooting tips
      if (error.message.includes('API key')) {
        console.log('\n💡 Troubleshooting Tips:');
        console.log('1. Make sure you have set your API key:');
        console.log('   export ANTHROPIC_API_KEY=your_key_here');
        console.log('   # or');
        console.log('   export OPENAI_API_KEY=your_key_here');
        console.log('2. Verify your API key is valid and has sufficient credits');
      }
      
      if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 Network Issues:');
        console.log('1. Check your internet connection');
        console.log('2. Verify firewall settings');
        console.log('3. Try again in a few moments');
      }
    } finally {
      // Cleanup
      if (this.agent) {
        this.log('🧹 Cleaning up agent...');
        await this.agent.stop();
      }
    }
  }

  async demonstrateModelSwitching() {
    console.log('\n🔄 Model Switching Demo');
    console.log('=======================\n');

    const providers = [
      {
        name: 'Anthropic Claude',
        provider: ModelProvider.ANTHROPIC,
        model: 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY
      },
      {
        name: 'OpenAI GPT-4 Vision',
        provider: ModelProvider.OPENAI,
        model: 'gpt-4-vision-preview',
        apiKey: process.env.OPENAI_API_KEY
      }
    ];

    for (const providerConfig of providers) {
      if (!providerConfig.apiKey) {
        this.log(`⏭️ Skipping ${providerConfig.name} (no API key)`);
        continue;
      }

      try {
        this.log(`🧪 Testing ${providerConfig.name}...`);
        
        const config = {
          ...demoConfig,
          model: {
            provider: providerConfig.provider,
            name: providerConfig.model,
            apiKey: providerConfig.apiKey,
            version: '1.0'
          }
        };

        const agent = new LocalComputerAgent();
        await agent.initialize(config);
        
        this.log(`✅ ${providerConfig.name} connected successfully!`);
        this.log('📊 Model Info:', agent.getModelInfo());
        
        await agent.stop();
        
      } catch (error) {
        this.log(`❌ ${providerConfig.name} failed:`, { error: error.message });
      }
    }
  }

  async showConnectionFlow() {
    console.log('\n🔗 LLM Connection Flow');
    console.log('======================\n');

    console.log('1. 🏗️  Agent Creation:');
    console.log('   - LocalComputerAgent instantiated');
    console.log('   - Capabilities defined (screen analysis, mouse/keyboard control)');
    
    console.log('\n2. 🔧 Model Initialization:');
    console.log('   - Model provider selected (Anthropic/OpenAI/Custom)');
    console.log('   - API credentials validated');
    console.log('   - Model-specific configuration applied');
    
    console.log('\n3. 📸 Screenshot Capture:');
    console.log('   - Screen operator captures current display');
    console.log('   - Image converted to base64 format');
    console.log('   - Metadata attached (dimensions, timestamp)');
    
    console.log('\n4. 🧠 LLM Analysis:');
    console.log('   - Screenshot + instruction sent to LLM');
    console.log('   - Model analyzes visual content');
    console.log('   - Actions generated based on analysis');
    
    console.log('\n5. ⚡ Action Execution:');
    console.log('   - Actions validated for safety');
    console.log('   - Input operator executes mouse/keyboard actions');
    console.log('   - Results captured and returned');
    
    console.log('\n6. 🔄 Iteration Loop:');
    console.log('   - New screenshot taken');
    console.log('   - Progress evaluated');
    console.log('   - Next actions determined');
    console.log('   - Process repeats until task complete');
  }
}

// Main execution
async function main() {
  const demo = new LLMConnectionDemo();
  
  try {
    // Show the connection flow
    await demo.showConnectionFlow();
    
    // Demonstrate actual connection
    await demo.demonstrateConnection();
    
    // Show model switching capabilities
    await demo.demonstrateModelSwitching();
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Set up your API keys in environment variables');
    console.log('2. Run the Robin Assistant desktop app');
    console.log('3. Configure your preferred model in settings');
    console.log('4. Start automating tasks!');
    
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run demo if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = LLMConnectionDemo;
