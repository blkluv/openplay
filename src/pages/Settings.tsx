import { useState } from 'react';
import { VideoLayout } from '@/components/video/VideoLayout';
import { useMediaServers } from '@/hooks/useMediaServers';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, Plus, Trash2, RotateCcw, AlertCircle, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export default function Settings() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { servers, isLoading, addServer, removeServer, toggleServer, resetToDefaults } = useMediaServers();
  const [newServerUrl, setNewServerUrl] = useState('');
  const [addingServer, setAddingServer] = useState(false);

  const handleAddServer = async () => {
    if (!newServerUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a server URL',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      const url = new URL(newServerUrl.trim());
      if (!url.protocol.startsWith('http')) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Please enter a valid HTTPS URL',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addServer(newServerUrl.trim());
      setNewServerUrl('');
      setAddingServer(false);
      toast({
        title: 'Success',
        description: 'Media server added successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add server',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveServer = async (url: string) => {
    try {
      await removeServer(url);
      toast({
        title: 'Success',
        description: 'Media server removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove server',
        variant: 'destructive',
      });
    }
  };

  const handleToggleServer = async (url: string) => {
    try {
      await toggleServer(url);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle server',
        variant: 'destructive',
      });
    }
  };

  const handleResetToDefaults = async () => {
    try {
      await resetToDefaults();
      toast({
        title: 'Success',
        description: 'Media servers reset to defaults',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset servers',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <VideoLayout>
        <div className="container py-6 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please sign in to access settings.
            </AlertDescription>
          </Alert>
        </div>
      </VideoLayout>
    );
  }

  return (
    <VideoLayout>
      <div className="container max-w-4xl py-6 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your SHORTZ preferences and configurations
            </p>
          </div>

          {/* Media Servers Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Media Servers
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Configure Blossom servers for uploading videos and media files.
                    Files will be uploaded to enabled servers.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDefaults}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-md">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Server List */}
                  <div className="space-y-2">
                    {servers.map((server) => (
                      <div
                        key={server.url}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Switch
                            checked={server.enabled}
                            onCheckedChange={() => handleToggleServer(server.url)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{server.url}</p>
                            <p className="text-xs text-muted-foreground">
                              {server.enabled ? (
                                <span className="flex items-center gap-1">
                                  <Check className="h-3 w-3 text-green-500" />
                                  Enabled
                                </span>
                              ) : (
                                'Disabled'
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveServer(server.url)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Server Section */}
                  {!addingServer ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setAddingServer(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Media Server
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 border rounded-md bg-muted/50">
                      <div>
                        <Label htmlFor="server-url">Server URL</Label>
                        <Input
                          id="server-url"
                          value={newServerUrl}
                          onChange={(e) => setNewServerUrl(e.target.value)}
                          placeholder="https://blossom.example.com/"
                          className="mt-1.5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddServer();
                            } else if (e.key === 'Escape') {
                              setAddingServer(false);
                              setNewServerUrl('');
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter a Blossom-compatible media server URL
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddServer} className="flex-1">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Server
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAddingServer(false);
                            setNewServerUrl('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Info Alert */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      When uploading media, files will be uploaded to all enabled servers.
                      At least one server must be enabled.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </VideoLayout>
  );
}
