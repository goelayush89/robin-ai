import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Monitor,
  Globe,
  MousePointer,
  Keyboard,
  Download
} from 'lucide-react';

export function AutomationCapabilities() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            Browser Environment Capabilities
          </CardTitle>
          <CardDescription>
            What Robin Assistant can and cannot do in your web browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* What Works */}
            <div className="space-y-3">
              <h3 className="font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                ✅ What Works
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50">Web Page</Badge>
                  <span className="text-sm">Scroll, click links, fill forms</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50">Screenshots</Badge>
                  <span className="text-sm">Capture and analyze screen content</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50">AI Analysis</Badge>
                  <span className="text-sm">Understand and plan actions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50">Navigation</Badge>
                  <span className="text-sm">Browse websites and web apps</span>
                </div>
              </div>
            </div>

            {/* What Doesn't Work */}
            <div className="space-y-3">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                ❌ Browser Limitations
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50">Desktop Apps</Badge>
                  <span className="text-sm">Cannot click desktop icons</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50">System Control</Badge>
                  <span className="text-sm">Cannot control mouse/keyboard globally</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50">File System</Badge>
                  <span className="text-sm">Cannot access files or folders</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50">Other Apps</Badge>
                  <span className="text-sm">Cannot interact with other software</span>
                </div>
              </div>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Why these limitations exist:</strong> Web browsers have security restrictions 
              that prevent websites from controlling your computer outside the browser window. 
              This protects you from malicious websites.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-purple-500" />
            Desktop App Capabilities
          </CardTitle>
          <CardDescription>
            Full automation capabilities with the desktop application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                ✅ Full System Control
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MousePointer className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Click anywhere on screen</span>
                </div>
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Type in any application</span>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Launch desktop applications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Control web browsers</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-purple-700">🚀 Advanced Features</h3>
              <div className="space-y-2">
                <div className="text-sm">• Cross-application workflows</div>
                <div className="text-sm">• File system operations</div>
                <div className="text-sm">• System settings automation</div>
                <div className="text-sm">• Multi-monitor support</div>
                <div className="text-sm">• Background task automation</div>
                <div className="text-sm">• Scheduled automation</div>
              </div>
            </div>
          </div>

          <Alert>
            <Download className="w-4 h-4" />
            <AlertDescription>
              <strong>Get the desktop app</strong> for complete automation capabilities. 
              The desktop version can control your entire computer, not just web pages.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🎯 What You Can Test Right Now</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-800">✅ Try These Commands (Browser):</h4>
              <div className="mt-2 space-y-1 text-sm text-green-700">
                <div>• "Take a screenshot and describe what you see"</div>
                <div>• "Scroll down on this page"</div>
                <div>• "Analyze the current webpage"</div>
                <div>• "What elements can I interact with?"</div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-800">🖥️ Desktop App Commands:</h4>
              <div className="mt-2 space-y-1 text-sm text-blue-700">
                <div>• "Click on the Chrome icon and open Google"</div>
                <div>• "Open Notepad and type a message"</div>
                <div>• "Take a screenshot of my desktop"</div>
                <div>• "Open my email and check for new messages"</div>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 rounded-lg">
              <h4 className="font-semibold text-yellow-800">⚠️ Won't Work in Browser:</h4>
              <div className="mt-2 space-y-1 text-sm text-yellow-700">
                <div>• "Click on desktop icons" (security restriction)</div>
                <div>• "Open other applications" (browser limitation)</div>
                <div>• "Control system settings" (permission required)</div>
                <div>• "Access files outside browser" (security policy)</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
