import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Download, 
  Smartphone, 
  Share, 
  PlusSquare, 
  MoreVertical,
  Check,
  Wifi,
  WifiOff,
  Zap,
  Shield,
  ArrowLeft,
  Monitor,
  Apple,
  Chrome
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Install = () => {
  const { isInstalled, isInstallable, promptInstall, isIOS, isAndroid, isStandalone } = useInstallPrompt();
  const [installAttempted, setInstallAttempted] = useState(false);

  const handleInstallClick = async () => {
    setInstallAttempted(true);
    await promptInstall();
  };

  const benefits = [
    {
      icon: Zap,
      title: 'Instant Access',
      description: 'Launch from your home screen in one tap, just like a native app.',
    },
    {
      icon: WifiOff,
      title: 'Works Offline',
      description: 'Access your data and complete checks even without internet.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your data stays on your device with automatic sync when online.',
    },
    {
      icon: Wifi,
      title: 'Auto Updates',
      description: 'Always get the latest features without manual updates.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back link */}
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
              <Download className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Install Ride Ready Docs
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Add Ride Ready Docs to your device for the best experience. 
              Quick access, offline support, and seamless performance.
            </p>

            {isInstalled || isStandalone ? (
              <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 rounded-full">
                <Check className="h-5 w-5" />
                <span className="font-medium">Already Installed!</span>
              </div>
            ) : isInstallable && !isIOS ? (
              <Button 
                size="lg" 
                onClick={handleInstallClick}
                className="mt-8 gap-2"
              >
                <Download className="h-5 w-5" />
                Install Now
              </Button>
            ) : null}
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="bg-card/50">
                <CardContent className="flex items-start gap-4 pt-6">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Installation Instructions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                How to Install
              </CardTitle>
              <CardDescription>
                Select your device type for step-by-step instructions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="ios" className="gap-2">
                    <Apple className="h-4 w-4" />
                    iPhone/iPad
                  </TabsTrigger>
                  <TabsTrigger value="android" className="gap-2">
                    <Smartphone className="h-4 w-4" />
                    Android
                  </TabsTrigger>
                  <TabsTrigger value="desktop" className="gap-2">
                    <Monitor className="h-4 w-4" />
                    Desktop
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ios" className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Open in Safari</h4>
                        <p className="text-sm text-muted-foreground">
                          Make sure you're viewing this page in Safari browser (not Chrome or other browsers).
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                          Tap the Share button
                          <Share className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Find the Share icon at the bottom of Safari (square with arrow pointing up).
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                          Select "Add to Home Screen"
                          <PlusSquare className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Scroll down in the share menu and tap "Add to Home Screen".
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Tap "Add"</h4>
                        <p className="text-sm text-muted-foreground">
                          Confirm by tapping "Add" in the top right corner. The app icon will appear on your home screen.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="android" className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                          Open in Chrome
                          <Chrome className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Make sure you're viewing this page in Chrome browser.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                          Tap the menu button
                          <MoreVertical className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Tap the three dots in the top right corner of Chrome.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                          Select "Install app" or "Add to Home screen"
                          <Download className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Look for "Install app" (preferred) or "Add to Home screen" in the menu.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Confirm installation</h4>
                        <p className="text-sm text-muted-foreground">
                          Tap "Install" in the popup. The app will be added to your home screen and app drawer.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="desktop" className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                          Open in Chrome, Edge, or Brave
                          <Chrome className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          These browsers support installing web apps as desktop applications.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Look for the install icon</h4>
                        <p className="text-sm text-muted-foreground">
                          In the address bar, look for a small install icon (computer with download arrow) on the right side.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Click "Install"</h4>
                        <p className="text-sm text-muted-foreground">
                          Click the icon and confirm installation. The app will open in its own window.
                        </p>
                      </div>
                    </div>

                    {isInstallable && !isIOS && (
                      <div className="pt-4">
                        <Button onClick={handleInstallClick} className="gap-2">
                          <Download className="h-4 w-4" />
                          Install Now
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium text-foreground mb-2">Is this a real app?</h4>
                <p className="text-sm text-muted-foreground">
                  Yes! Ride Ready Docs is a Progressive Web App (PWA), which means it works just like a native app 
                  but without needing to download it from an app store. It's faster, uses less storage, and always stays up to date.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground mb-2">Do I need internet to use it?</h4>
                <p className="text-sm text-muted-foreground">
                  Many features work offline! You can view your equipment, access documents, and complete checks even 
                  without internet. Data syncs automatically when you're back online.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground mb-2">How much storage does it use?</h4>
                <p className="text-sm text-muted-foreground">
                  The app itself uses very little storage (a few megabytes). Cached data for offline use varies 
                  based on your usage, but it's automatically managed by your device.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground mb-2">How do I uninstall it?</h4>
                <p className="text-sm text-muted-foreground">
                  Uninstall it like any other app. On iOS, long-press the icon and tap "Remove App". 
                  On Android, drag it to "Uninstall" or use your app settings. On desktop, right-click 
                  and choose "Uninstall".
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Help Link */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Still having trouble? We're here to help.
            </p>
            <Link to="/help">
              <Button variant="outline">Visit Help Center</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Install;
