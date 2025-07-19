import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

export default function StreamingGuide() {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          YouTube Live Streaming Setup Guide
        </CardTitle>
        <CardDescription>
          Follow these steps to stream successfully to YouTube
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Your YouTube channel must have live streaming enabled and be verified.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">1</Badge>
            <div>
              <h4 className="font-semibold">Enable YouTube Live</h4>
              <p className="text-sm text-muted-foreground">
                Go to YouTube Studio → Create → Go Live. Your channel needs to be verified and have no live streaming restrictions in the past 90 days.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">2</Badge>
            <div>
              <h4 className="font-semibold">Create Stream</h4>
              <p className="text-sm text-muted-foreground">
                Click "Create Stream" or "Stream Now" in YouTube Studio. Set your stream title, description, and privacy settings.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">3</Badge>
            <div>
              <h4 className="font-semibold">Get Stream Key</h4>
              <p className="text-sm text-muted-foreground">
                Copy the "Stream Key" from YouTube Studio. This key is unique to each stream and expires after use.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">4</Badge>
            <div>
              <h4 className="font-semibold">Configure Stream Settings</h4>
              <p className="text-sm text-muted-foreground">
                Paste the stream key in the "Stream Configuration" section. Select YouTube as platform and set video quality.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">5</Badge>
            <div>
              <h4 className="font-semibold">Start Streaming</h4>
              <p className="text-sm text-muted-foreground">
                Upload a video, set it as current, and click "Start Stream". Your video will loop continuously until stopped.
              </p>
            </div>
          </div>
        </div>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> Viewer count shows 0 because we cannot access YouTube's real-time analytics. Check your YouTube Studio for actual viewer statistics.
          </AlertDescription>
        </Alert>

        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">Common Issues:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Stream key expired - Generate a new one in YouTube Studio</li>
            <li>• Channel not verified - Complete phone verification</li>
            <li>• Live streaming disabled - Check channel restrictions</li>
            <li>• Wrong stream key - Copy the exact key from YouTube Studio</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}