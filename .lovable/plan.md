

## Offline GPS Location with Deferred Address Resolution

This plan implements two enhancements to the GPS location feature for offline use:
1. Show a clear message when offline indicating GPS coordinates are captured and address will resolve when online
2. Resolve the address from raw coordinates during the sync process

### How It Will Work

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        OFFLINE GPS FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User taps "Get GPS Location" while offline:                       │
│                                                                     │
│  1. GPS hardware captures coordinates (works via satellite)        │
│  2. App detects offline status                                     │
│  3. Stores raw coordinates: "52.485612, -1.890401"                 │
│  4. Sets flag: needsAddressResolution = true                       │
│  5. Shows toast: "GPS captured - address resolves when online"     │
│                                                                     │
│  When sync runs (online):                                          │
│                                                                     │
│  1. Check finds pending checks with unresolved coordinates         │
│  2. Calls OpenStreetMap API to convert to readable address         │
│  3. Updates location field with full address                       │
│  4. Submits to Supabase with resolved address                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Changes Overview

**1. Update OfflineCheck interface** (`src/lib/offlineDb.ts`)
   - Add new fields to track raw GPS coordinates separately:
     - `rawLatitude?: number` - Raw GPS latitude  
     - `rawLongitude?: number` - Raw GPS longitude
     - `needsAddressResolution?: boolean` - Flag indicating address needs lookup
   - Bump database version to add migration support

**2. Modify GPS capture in InspectionChecklist** (`src/components/InspectionChecklist.tsx`)
   - Detect if offline when GPS button is pressed
   - If offline:
     - Store raw coordinates in the location field (e.g., "52.4856, -1.8904")
     - Track that this needs address resolution
     - Show toast: "📍 GPS location captured - address will resolve when online"
   - Pass the raw coordinates to the check submission

**3. Update useOfflineCheck hook** (`src/hooks/useOfflineCheck.tsx`)
   - Accept new optional parameters for raw coordinates
   - Store `rawLatitude`, `rawLongitude`, and `needsAddressResolution` in IndexedDB

**4. Enhance sync process** (`src/hooks/useOfflineSync.tsx`)
   - Before syncing a check that has `needsAddressResolution = true`:
     - Call OpenStreetMap Nominatim API to reverse geocode coordinates
     - Build a clean, short address from the response
     - Update the location field with the resolved address
   - If address resolution fails, keep the raw coordinates (fallback)

### Technical Details

**Address Resolution Function:**
```typescript
async function resolveAddress(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await response.json();
    
    if (data.address) {
      const parts = [];
      if (data.address.road) parts.push(data.address.road);
      if (data.address.village || data.address.town || data.address.city) {
        parts.push(data.address.village || data.address.town || data.address.city);
      }
      if (data.address.county) parts.push(data.address.county);
      if (data.address.postcode) parts.push(data.address.postcode);
      return parts.join(', ') || data.display_name;
    }
  } catch (e) {
    console.error('Address resolution failed:', e);
  }
  return null;
}
```

**Yes, the address will resolve during sync** because:
- The sync process runs when the device is online
- The Nominatim geocoding API is publicly accessible
- We resolve the address before inserting into Supabase, so the database receives the full address

### User Experience

| Scenario | Current Behavior | New Behavior |
|----------|-----------------|--------------|
| GPS button pressed offline | Coordinates saved with "address lookup failed" message | Coordinates saved with "GPS captured - address will resolve when online" message |
| Check synced later | Raw coordinates stored permanently | Address automatically resolved and stored |
| Address resolution fails during sync | N/A | Falls back to raw coordinates (safe fallback) |

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/offlineDb.ts` | Add coordinate fields to OfflineCheck interface, bump DB version |
| `src/components/InspectionChecklist.tsx` | Detect offline state in GPS capture, show appropriate toast, pass raw coords |
| `src/hooks/useOfflineCheck.tsx` | Add coordinate parameters to CheckSubmission interface |
| `src/hooks/useOfflineSync.tsx` | Add address resolution step before syncing checks |

