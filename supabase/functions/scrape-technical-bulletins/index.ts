import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting technical bulletin scraping...');
    
    // Scrape ADIPS bulletins
    const adipsResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://adips.co.uk/new-technical-bulletins-available/',
        formats: ['markdown'],
        extractorOptions: {
          mode: 'llm-extraction',
          extractionPrompt: 'Extract technical bulletins with title, bulletin number, issue date, content, and priority level (high/medium/low). Include any ride category information.'
        }
      })
    });

    const adipsData = await adipsResponse.json();
    console.log('ADIPS response:', adipsData);

    // Scrape RidesDatabase bulletins
    const ridesDbResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://ridesdatabase.org/safety-bulletins',
        formats: ['markdown'],
        extractorOptions: {
          mode: 'llm-extraction',
          extractionPrompt: 'Extract safety bulletins and technical information with title, date, content, and any ride type or category information.'
        }
      })
    });

    const ridesDbData = await ridesDbResponse.json();
    console.log('RidesDatabase response:', ridesDbData);

    // Process and store bulletins
    const bulletins = [];
    
    if (adipsData.success && adipsData.data?.markdown) {
      // Parse ADIPS bulletins from markdown content
      const adipsBulletins = parseAdipsBulletins(adipsData.data.markdown);
      bulletins.push(...adipsBulletins);
    }

    if (ridesDbData.success && ridesDbData.data?.markdown) {
      // Parse RidesDatabase bulletins from markdown content
      const ridesDbBulletins = parseRidesDbBulletins(ridesDbData.data.markdown);
      bulletins.push(...ridesDbBulletins);
    }

    console.log(`Found ${bulletins.length} bulletins to process`);

    // Get all categories for smart matching
    const { data: categories } = await supabase
      .from('ride_categories')
      .select('*')
      .order('name');

    if (!categories || categories.length === 0) {
      throw new Error('No ride categories found');
    }

    // Store bulletins in database with smart categorization
    const storedBulletins = [];
    for (const bulletin of bulletins) {
      // Try to find best category match, fallback to first category
      const bestCategoryId = getBestCategoryForBulletin(bulletin, categories) || categories[0].id;
      
      const { data, error } = await supabase
        .from('technical_bulletins')
        .upsert({
          title: bulletin.title,
          content: bulletin.content,
          bulletin_number: bulletin.bulletinNumber,
          priority: bulletin.priority || 'medium',
          category_id: bestCategoryId,
          issue_date: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'bulletin_number',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Error storing bulletin:', error);
      } else {
        storedBulletins.push(data?.[0]);
      }
    }

    console.log(`Successfully stored ${storedBulletins.length} bulletins`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraped and stored ${storedBulletins.length} technical bulletins`,
        bulletins: storedBulletins
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in scrape-technical-bulletins function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

interface Bulletin {
  title: string;
  content: string;
  bulletinNumber: string;
  priority: string;
  source: string;
}

function parseAdipsBulletins(markdown: string): Bulletin[] {
  const bulletins: Bulletin[] = [];
  
  // Look for bulletin patterns in the markdown
  const bulletinRegex = /(?:bulletin|technical\s+bulletin)\s*[#:]?\s*([^:\n]+)[\s\S]*?(?=(?:bulletin|technical\s+bulletin)|$)/gi;
  const matches = markdown.match(bulletinRegex) || [];
  
  matches.forEach((match, index) => {
    const lines = match.split('\n').filter(line => line.trim());
    const title = lines[0]?.replace(/[#*]/g, '').trim() || `ADIPS Bulletin ${index + 1}`;
    
    // Extract bulletin number from title or content
    const bulletinNumberMatch = match.match(/(?:TB|BULLETIN)\s*[#:]?\s*(\d+)/i);
    const bulletinNumber = bulletinNumberMatch ? `ADIPS-${bulletinNumberMatch[1]}` : `ADIPS-${Date.now()}-${index}`;
    
    // Determine priority based on keywords
    let priority = 'medium';
    if (/urgent|critical|immediate/i.test(match)) priority = 'high';
    if (/info|information|note/i.test(match)) priority = 'low';
    
    bulletins.push({
      title: title,
      content: match.trim(),
      bulletinNumber: bulletinNumber,
      priority: priority,
      source: 'ADIPS'
    });
  });
  
  return bulletins;
}

function parseRidesDbBulletins(markdown: string): Bulletin[] {
  const bulletins: Bulletin[] = [];
  
  // Look for safety bulletin patterns
  const bulletinRegex = /(?:safety\s+bulletin|alert|notice)\s*[#:]?\s*([^:\n]+)[\s\S]*?(?=(?:safety\s+bulletin|alert|notice)|$)/gi;
  const matches = markdown.match(bulletinRegex) || [];
  
  matches.forEach((match, index) => {
    const lines = match.split('\n').filter(line => line.trim());
    const title = lines[0]?.replace(/[#*]/g, '').trim() || `Safety Bulletin ${index + 1}`;
    
    // Extract bulletin number or create one
    const bulletinNumberMatch = match.match(/(?:SB|SAFETY|ALERT)\s*[#:]?\s*(\d+)/i);
    const bulletinNumber = bulletinNumberMatch ? `RDB-${bulletinNumberMatch[1]}` : `RDB-${Date.now()}-${index}`;
    
    // Safety bulletins are typically high priority
    const priority = /urgent|critical|warning|danger/i.test(match) ? 'high' : 'medium';
    
    bulletins.push({
      title: title,
      content: match.trim(),
      bulletinNumber: bulletinNumber,
      priority: priority,
      source: 'RidesDatabase'
    });
  });
  
  return bulletins;
}

/**
 * Get the best category ID for a bulletin based on its content
 */
function getBestCategoryForBulletin(
  bulletin: { title: string; content: string }, 
  categories: any[]
): string | null {
  const content = `${bulletin.title} ${bulletin.content}`.toLowerCase();
  
  // Ride type keywords mapping
  const rideTypeKeywords: Record<string, string[]> = {
    'chair-o-plane': ['chair o plane', 'chair-o-plane', 'chairoplane', 'flying chairs', 'chair swing', 'wave swinger'],
    'ferris-wheel': ['ferris wheel', 'big wheel', 'observation wheel', 'giant wheel'],
    'carousel': ['carousel', 'merry-go-round', 'roundabout', 'horses'],
    'roller-coaster': ['roller coaster', 'coaster', 'rollercoaster'],
    'bumper-cars': ['bumper cars', 'dodgems', 'bumper car', 'dodgem'],
    'helter-skelter': ['helter skelter', 'slide', 'spiral slide'],
    'waltzers': ['waltzer', 'waltzers', 'spinning ride'],
    'pirate-ship': ['pirate ship', 'pendulum', 'swinging ship'],
    'spinning-ride': ['spinning', 'centrifuge', 'gravitron', 'rotor'],
    'drop-tower': ['drop tower', 'drop ride', 'free fall', 'freefall'],
    'swinging-ride': ['swing', 'swinging', 'pendulum'],
    'dark-ride': ['dark ride', 'ghost train', 'haunted house'],
    'water-ride': ['log flume', 'water ride', 'splash', 'rapids'],
    'inflatable': ['inflatable', 'bouncy castle', 'bounce', 'air bag'],
    'go-kart': ['go kart', 'go-kart', 'karting', 'racing'],
    'train-ride': ['train', 'railway', 'locomotive'],
    'playground': ['playground', 'climbing frame', 'play area', 'soft play']
  };

  // First, try direct category name matching
  for (const category of categories) {
    const categoryName = category.name.toLowerCase();
    if (content.includes(categoryName)) {
      return category.id;
    }
  }

  // Then try keyword matching
  for (const [rideType, keywords] of Object.entries(rideTypeKeywords)) {
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        // Try to find a category that matches this ride type
        for (const category of categories) {
          const categoryName = category.name.toLowerCase();
          if (categoryName.includes(rideType.replace('-', ' ')) || 
              categoryName.includes(rideType) ||
              keywords.some(k => categoryName.includes(k))) {
            return category.id;
          }
        }
      }
    }
  }

  // Return null to use default
  return null;
}