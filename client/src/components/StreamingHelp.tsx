import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, ExternalLink, Info } from 'lucide-react';

export default function StreamingHelp() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Viewer count shows 0 because we cannot access YouTube's real-time analytics. Check YouTube Studio for actual viewer statistics.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">YouTube Live Streaming Requirements</CardTitle>
          <CardDescription>
            Make sure your YouTube channel meets these requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Channel must be verified (phone number)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">No live streaming restrictions in past 90 days</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Stream key must be active in YouTube Studio</span>
            </div>
          </div>

          <div className="pt-3 border-t">
            <h4 className="font-semibold mb-2">Quick Setup Steps:</h4>
            <ol className="text-sm text-muted-foreground space-y-1">
              <li>1. Go to YouTube Studio → Create → Go Live</li>
              <li>2. Click "Create Stream" or "Stream Now"</li>
              <li>3. Copy the Stream Key</li>
              <li>4. Paste it in Stream Configuration below</li>
              <li>5. Upload a video and start streaming</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}