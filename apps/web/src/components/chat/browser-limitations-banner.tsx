import { useState } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Info, 
  X, 
  Globe, 
  Monitor, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export function BrowserLimitationsBanner() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-blue-800">Browser Environment</span>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">Limited Automation</Badge>
            </div>
            
            <AlertDescription className="text-blue-700">
              <div className="space-y-2">
                <p>
                  Robin Assistant is running in your web browser, which has security restrictions 
                  that limit automation capabilities.
                </p>
                
                {isExpanded && (
                  <div className="space-y-3 mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>What Works:</span>
                        </div>
                        <ul className="text-sm space-y-1 ml-6">
                          <li>• Take screenshots and analyze content</li>
                          <li>• Scroll and interact with this webpage</li>
                          <li>• Show AI reasoning and action plans</li>
                          <li>• Demonstrate automation concepts</li>
                        </ul>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span>Browser Limitations:</span>
                        </div>
                        <ul className="text-sm space-y-1 ml-6">
                          <li>• Cannot click desktop applications</li>
                          <li>• Cannot control mouse/keyboard globally</li>
                          <li>• Cannot access files or other programs</li>
                          <li>• Cannot perform system-level automation</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Monitor className="w-5 h-5 text-purple-600" />
                      <div className="flex-1">
                        <div className="font-medium text-purple-800">For Full Automation:</div>
                        <div className="text-sm text-purple-700">
                          Download the desktop app to control your entire computer, not just web pages.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 p-1 h-auto"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Learn More
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 p-1 h-auto ml-2"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Alert>
  );
}

export function QuickTestSuggestions() {
  const suggestions = [
    {
      category: "✅ Try These (Browser)",
      commands: [
        "Take a screenshot and describe what you see",
        "Scroll down on this page",
        "Analyze the current webpage layout",
        "What can you see on my screen right now?"
      ],
      color: "green"
    },
    {
      category: "🖥️ Desktop App Only",
      commands: [
        "Click on the Chrome icon and open Google",
        "Open Notepad and type a message",
        "Take a screenshot of my desktop",
        "Launch my email application"
      ],
      color: "blue"
    }
  ];

  return (
    <div className="space-y-3 mb-4">
      <div className="text-sm font-medium text-gray-700">💡 Quick Test Ideas:</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((group, index) => (
          <div key={index} className={`p-3 rounded-lg border ${
            group.color === 'green' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className={`font-medium mb-2 ${
              group.color === 'green' ? 'text-green-800' : 'text-blue-800'
            }`}>
              {group.category}
            </div>
            <div className="space-y-1">
              {group.commands.map((command, cmdIndex) => (
                <div key={cmdIndex} className={`text-xs p-2 rounded ${
                  group.color === 'green' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  "{command}"
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
