import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, RefreshCw, Globe, Shield } from 'lucide-react';

export const BulletinScraper = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastScraped, setLastScraped] = useState<Date | null>(null);
  const [scrapedCount, setScrapedCount] = useState<number>(0);
  const { toast } = useToast();

  const handleScrape = async () => {
    setIsLoading(true);
    
    try {
      console.log('Starting bulletin scrape...');
      
      const { data, error } = await supabase.functions.invoke('scrape-technical-bulletins', {
        body: {}
      });

      if (error) {
        throw error;
      }

      console.log('Scrape response:', data);

      if (data?.success) {
        setScrapedCount(data.bulletins?.length || 0);
        setLastScraped(new Date());
        
        toast({
          title: "Success!",
          description: `Scraped ${data.bulletins?.length || 0} technical bulletins from ADIPS and RidesDatabase`,
        });
      } else {
        throw new Error(data?.error || 'Failed to scrape bulletins');
      }
    } catch (error) {
      console.error('Error scraping bulletins:', error);
      toast({
        title: "Error",
        description: "Failed to scrape technical bulletins. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Globe className="h-5 w-5" />
          <CardTitle>Bulletin Scraper</CardTitle>
        </div>
        <CardDescription>
          Automatically scrape technical bulletins from ADIPS and RidesDatabase.org
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Data Sources:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                ADIPS
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                RidesDatabase.org
              </Badge>
            </div>
          </div>
          
          <Button 
            onClick={handleScrape} 
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{isLoading ? 'Scraping...' : 'Scrape Bulletins'}</span>
          </Button>
        </div>

        {lastScraped && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Scraped</p>
                <p className="text-sm">{lastScraped.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Bulletins Found</p>
                <p className="text-sm font-bold">{scrapedCount}</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p className="mb-1">• Scrapes latest technical bulletins and safety alerts</p>
          <p className="mb-1">• Automatically categorizes by priority level</p>
          <p>• Updates existing bulletins if new versions are available</p>
        </div>
      </CardContent>
    </Card>
  );
};