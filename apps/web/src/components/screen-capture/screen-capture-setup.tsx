import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { 
  Monitor, 
  Camera, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Settings
} from 'lucide-react';
import { requestScreenCapturePermission, getScreenCaptureInfo } from '../../services/browser-screen-capture';
import {
  isElectronEnvironment,
  getElectronScreenCaptureInfo,
  requestElectronScreenCapturePermission
} from '../../services/electron-screen-capture';

interface ScreenCaptureSetupProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export function ScreenCaptureSetup({ onPermissionGranted, onPermissionDenied }: ScreenCaptureSetupProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [screenCaptureInfo, setScreenCaptureInfo] = useState<any>(null);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'requesting'>('unknown');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const electronEnv = isElectronEnvironment();
    setIsElectron(electronEnv);

    const info = electronEnv ? getElectronScreenCaptureInfo() : getScreenCaptureInfo();
    setIsSupported(info.supported);
    setScreenCaptureInfo(info);
  }, []);

  const handleRequestPermission = async () => {
    setPermissionStatus('requesting');
    setIsInitializing(true);

    try {
      let granted = false;

      if (isElectron) {
        // Use Electron screen capture API
        granted = await requestElectronScreenCapturePermission();
      } else {
        // Use browser screen capture API
        granted = await requestScreenCapturePermission();
      }

      if (granted) {
        setPermissionStatus('granted');
        onPermissionGranted?.();
      } else {
        setPermissionStatus('denied');
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      setPermissionStatus('denied');
      onPermissionDenied?.();
    } finally {
      setIsInitializing(false);
    }
  };

  const getStatusIcon = () => {
    switch (permissionStatus) {
      case 'granted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'denied':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'requesting':
        return <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge variant="default" className="bg-green-100 text-green-800">Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      case 'requesting':
        return <Badge variant="secondary">Requesting...</Badge>;
      default:
        return <Badge variant="outline">Not Requested</Badge>;
    }
  };

  if (!isSupported) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
            <div>
              <CardTitle>Screen Capture Limited</CardTitle>
              <CardDescription>
                Real screen capture isn't available, but you can still test Robin Assistant
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Why screen capture isn't available:</strong></p>
                <p className="text-sm">{screenCaptureInfo?.reason}</p>
                {screenCaptureInfo?.suggestions && (
                  <div>
                    <p className="text-sm font-medium">Solutions:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {screenCaptureInfo.suggestions.map((suggestion: string, index: number) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>You can still test Robin Assistant:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Demo mode with simulated screenshots</li>
                  <li>AI instruction analysis and planning</li>
                  <li>See what actions would be taken</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-semibold">For full functionality:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Use HTTPS (https://localhost or deployed site)</li>
              <li>Download the desktop app for real automation</li>
              <li>Use Chrome, Firefox, or Edge browser</li>
            </ul>
          </div>

          <Button
            onClick={() => onPermissionGranted?.()}
            className="w-full"
            size="lg"
          >
            <Camera className="w-4 h-4 mr-2" />
            Continue with Demo Mode
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="w-6 h-6 text-blue-500" />
            <div>
              <CardTitle>Screen Capture Setup</CardTitle>
              <CardDescription>
                {isElectron
                  ? 'Robin Assistant Desktop has native screen capture capabilities for full automation'
                  : 'Robin Assistant needs screen capture permission to see and interact with your desktop'
                }
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {permissionStatus === 'unknown' && (
          <>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold">What Robin Assistant Can See</h3>
                  <p className="text-sm text-muted-foreground">
                    {isElectron
                      ? 'Robin Assistant Desktop has native access to capture your screen and understand what applications and UI elements are visible, enabling full desktop automation.'
                      : 'Robin Assistant will be able to see your entire screen to understand what applications and UI elements are visible, enabling it to perform automated tasks.'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Privacy & Security</h3>
                  <p className="text-sm text-muted-foreground">
                    {isElectron
                      ? 'All screen capture happens locally on your device with native desktop access. Screenshots are processed locally and only sent to your chosen AI model for analysis.'
                      : 'Screenshots are processed locally and only sent to your chosen AI model for analysis. No data is stored permanently or shared with third parties.'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Settings className="w-5 h-5 text-purple-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Control & Permissions</h3>
                  <p className="text-sm text-muted-foreground">
                    {isElectron
                      ? 'The desktop app has native screen capture capabilities and doesn\'t require browser permissions. You have full control over when automation runs.'
                      : 'You can revoke screen capture permission at any time through your browser settings. Robin Assistant will ask for permission each time you start a new session.'
                    }
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleRequestPermission}
              disabled={isInitializing}
              className="w-full"
              size="lg"
            >
              <Camera className="w-4 h-4 mr-2" />
              {isInitializing
                ? (isElectron ? 'Initializing Desktop Capture...' : 'Requesting Permission...')
                : (isElectron ? 'Enable Desktop Screen Capture' : 'Grant Screen Capture Permission')
              }
            </Button>
          </>
        )}

        {permissionStatus === 'requesting' && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {isElectron
                ? 'Initializing native desktop screen capture capabilities. This may take a moment...'
                : 'Please select your screen or application window in the browser dialog that appeared. This allows Robin Assistant to see and interact with your desktop.'
              }
            </AlertDescription>
          </Alert>
        )}

        {permissionStatus === 'granted' && (
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-green-800">
                  {isElectron ? 'Desktop screen capture enabled!' : 'Screen capture permission granted!'}
                </p>
                <p>
                  {isElectron
                    ? 'Robin Assistant Desktop can now capture your screen and perform full desktop automation. You can start using the chat interface to give instructions.'
                    : 'Robin Assistant can now see your screen and perform automated tasks. You can start using the chat interface to give instructions.'
                  }
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {permissionStatus === 'denied' && (
          <div className="space-y-4">
            <Alert>
              <XCircle className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-red-800">Screen capture permission denied</p>
                  <p>Robin Assistant needs screen capture permission to function. Without it, the AI cannot see your screen to perform automated tasks.</p>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-semibold">To enable screen capture:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click the camera/screen icon in your browser's address bar</li>
                <li>Select "Allow" for screen sharing</li>
                <li>Or try the button below to request permission again</li>
              </ol>
            </div>

            <Button 
              onClick={handleRequestPermission}
              variant="outline"
              className="w-full"
            >
              <Camera className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
