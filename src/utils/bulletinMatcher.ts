import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type TechnicalBulletin = Tables<'technical_bulletins'>;

/**
 * Matches technical bulletins with user's rides based on content analysis
 */
export class BulletinMatcher {
  private static rideTypeKeywords: Record<string, string[]> = {
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
    'food-stall': ['fish & chips', 'burger van', 'hot dog', 'candy floss', 'toffee apple', 'ice cream', 'donut', 'pizza', 'tea & coffee', 'popcorn', 'crepe', 'jacket potato', 'noodle', 'sweet stall'],
    'game-stall': ['hook-a-duck', 'ring toss', 'coconut shy', 'test your strength', 'shooting gallery', 'basketball', 'darts', 'arcade', 'penny arcade', 'hoopla', 'tombola'],
    'generator': ['generator', 'power', 'electricity', 'diesel']
  };

  /**
   * Extract ride type keywords from bulletin content
   */
  static extractRideTypes(content: string): string[] {
    const contentLower = content.toLowerCase();
    const matchedTypes: string[] = [];

    for (const [rideType, keywords] of Object.entries(this.rideTypeKeywords)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          matchedTypes.push(rideType);
          break; // Don't add the same type multiple times
        }
      }
    }

    return matchedTypes;
  }

  /**
   * Check if a bulletin is relevant to a specific ride
   */
  static isBulletinRelevantToRide(bulletin: TechnicalBulletin, ride: Ride): boolean {
    const bulletinContent = `${bulletin.title} ${bulletin.content || ''}`.toLowerCase();
    const rideName = ride.ride_name.toLowerCase();
    const categoryName = ride.ride_categories.name.toLowerCase();

    // Direct name match (e.g., bulletin mentions "chair o plane" and user has a chair o plane)
    if (bulletinContent.includes(rideName)) {
      return true;
    }

    // Category match
    if (bulletinContent.includes(categoryName)) {
      return true;
    }

    // Extract ride types from bulletin content
    const bulletinRideTypes = this.extractRideTypes(bulletinContent);
    
    // Check if any extracted ride types match the ride's category or name
    for (const rideType of bulletinRideTypes) {
      const keywords = this.rideTypeKeywords[rideType] || [];
      
      // Check if ride name matches any keywords for this ride type
      for (const keyword of keywords) {
        if (rideName.includes(keyword) || categoryName.includes(keyword)) {
          return true;
        }
      }
    }

    // Manufacturer-specific bulletins (if bulletin mentions manufacturer)
    if (ride.manufacturer && bulletinContent.includes(ride.manufacturer.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Filter bulletins based on user's rides
   */
  static filterBulletinsForRides(bulletins: TechnicalBulletin[], rides: Ride[]): TechnicalBulletin[] {
    if (rides.length === 0) {
      return bulletins; // If no rides, show all bulletins
    }

    return bulletins.filter(bulletin => {
      // Check if bulletin is relevant to any of the user's rides
      return rides.some(ride => this.isBulletinRelevantToRide(bulletin, ride));
    });
  }

  /**
   * Get the best category ID for a bulletin based on its content
   */
  static getBestCategoryForBulletin(
    bulletin: { title: string; content: string }, 
    categories: Tables<'ride_categories'>[]
  ): string | null {
    const content = `${bulletin.title} ${bulletin.content}`.toLowerCase();
    const rideTypes = this.extractRideTypes(content);

    // Try to match extracted ride types with available categories
    for (const rideType of rideTypes) {
      const keywords = this.rideTypeKeywords[rideType];
      
      for (const category of categories) {
        const categoryName = category.name.toLowerCase();
        
        for (const keyword of keywords) {
          if (categoryName.includes(keyword) || keyword.includes(categoryName)) {
            return category.id;
          }
        }
      }
    }

    // If no specific match, try direct category name matching
    for (const category of categories) {
      const categoryName = category.name.toLowerCase();
      if (content.includes(categoryName)) {
        return category.id;
      }
    }

    // Return first category as fallback
    return categories[0]?.id || null;
  }
}