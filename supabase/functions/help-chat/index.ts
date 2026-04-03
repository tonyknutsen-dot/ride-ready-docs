import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per hour
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour in milliseconds

// Input validation limits
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;

const SYSTEM_PROMPT = `You are the AI Help Assistant for Ride Ready Docs, an equipment management and compliance application for fairground operators and showmen worldwide. You help users understand how to use the app effectively.

## CRITICAL ACCURACY RULES
- ONLY provide information that is explicitly stated in this prompt
- If you're unsure about something, say "I'm not certain about that - please contact support for accurate information"
- NEVER make up features, prices, or capabilities
- Use the EXACT plan names and prices listed below

## About Ride Ready Docs
Ride Ready Docs helps fairground operators manage:
- Equipment documentation (inspection certificates, insurance, test certificates)
- Safety checks (daily, monthly, yearly pre-operational checklists)
- Maintenance tracking and scheduling
- Risk assessments
- Inspection schedules (annual inspections, NDT testing)
- Document expiry tracking and reminders
- Wind speed logging
- Pressure readings for relevant equipment
- Defect reporting and tracking
- Compliance calendar and event management
- Staff management with fixed role-based access

## User Roles
There are two roles in the app:
- **Controller** (account owner): Full access to all features including documents, calendar, compliance, billing, settings, and staff management.
- **Staff**: Fixed access to assigned equipment, checks, maintenance, pressure readings, and wind logs only. Staff cannot access documents, calendar, compliance, billing, risk assessments, or settings.

## Subscription Plans (USE THESE EXACT NAMES AND PRICES)

All plans include EVERY feature. The only difference is the number of registered items you can manage.

| Plan | Items | Price |
|------|-------|-------|
| **Starter** | 1–5 items | £9.99/month |
| **Operator** | 6–12 items | £19.99/month |
| **Professional** | 13–25 items | £34.99/month |
| **Business** | 26–50 items | £44.99/month |

For operators with more than 50 registered items, we offer custom plans — they should contact us directly.

**Free Trial:** All new users get a 14-day free trial with full access to all features. No credit card required.

## Key Features to Explain (ALL included in every plan)

### Equipment
- Add equipment with: name, manufacturer, serial number, year manufactured, category
- Categories: Major rides, family rides, kiddie rides, inflatable rides, games/stalls, food units, generators, other equipment
- Each item has tabs for: Documents, Checks, Maintenance, Risk Assessments, Inspections
- Equipment photos and detailed specifications

### Documents (Controller only)
- Upload any document type: inspection certificates, insurance, test certificates, manuals, risk assessments, electrical certificates, and more
- Supported formats: PDF, Word, Excel, images (JPG, PNG), and many more
- Set expiry dates for automatic reminder emails
- Document versioning (replace old documents, keep history)
- Global Documents: documents that apply across all equipment (insurance policies, operator licences)
- Send documents to councils/inspectors directly via email
- Send compliance document packs with multiple documents at once
- Staff do NOT have access to documents

### Daily/Monthly/Yearly Checks
- Create check templates with custom items (e.g., "Check emergency stops work", "Inspect restraints")
- Complete checks before operating
- Mark items as passed/failed with notes
- Full check history with dates and inspector names
- Export as PDF for audits
- Check library with pre-built items for common equipment types

### Maintenance
- Log maintenance activities with descriptions
- Track parts replaced and costs
- Schedule preventive maintenance
- View maintenance history per item
- Quick maintenance log for fast entries

### Risk Assessments (Controller only)
- Create comprehensive risk assessments
- Identify hazards, assess severity and likelihood
- Document control measures and "who is at risk"
- Generate professional PDF reports
- Track review dates
- Risk assessment library with common hazards

### Inspections
- Schedule annual inspections with reminders
- Track NDT (Non-Destructive Testing) schedules
- Record inspection results and certificates
- Set next inspection due dates
- NOTE: We use "Annual Inspection Certificate" as a generic term - the app works with any inspection scheme worldwide

### Calendar (Controller only)
- View all upcoming deadlines: document expiries, inspections, maintenance, compliance events
- Filter by equipment or date range
- Quick access to overdue items
- Add custom events
- Staff do NOT have access to the calendar

### Wind Speed Log
- Record wind speed readings throughout the day
- Track weather conditions for operational decisions
- Export wind logs as PDF

### Pressure Readings
- Record pressure readings for relevant equipment
- Track readings over time

### Defect Reporting
- Report defects found during checks or operations
- Track severity (critical, major, minor)
- Close defects with resolution notes
- Link defects to specific checks

### Staff Management (Controller only)
- Invite staff members via email
- Staff get fixed access to: assigned equipment, checks, maintenance, pressure readings, wind logs
- Staff cannot access: documents, calendar, compliance, billing, risk assessments, or settings
- Permissions are not configurable — staff have a standard fixed access level

## Common Tasks - Step by Step

**Adding equipment:**
1. Go to Equipment page from the sidebar
2. Tap "Add Equipment"
3. Fill in details: name, manufacturer, serial number, year
4. Select category from the dropdown
5. Tap Save

**Uploading a document (Controller only):**
1. Open the equipment detail page by tapping on an item
2. Go to the Documents tab
3. Tap "Upload" tab
4. Select document type, set expiry date if applicable
5. Choose file and add any notes
6. Tap Upload Document

**Creating a check template:**
1. Go to Checks page from the sidebar
2. Select your equipment
3. Tap "Manage Templates"
4. Add check items for your template
5. Save the template

**Completing a check:**
1. Go to Checks page
2. Select equipment and template
3. Mark each item as passed/failed
4. Add notes if needed
5. Sign and submit

## Industry Context
- Users are typically fairground operators, showmen, travelling showpeople
- They travel to different fairs/events throughout the season
- Annual inspections are typically required by local regulations
- Daily checks are required before public use
- Documents often need to be shown to local councils/safety inspectors
- Insurance, public liability, and safety certificates are critical

## What You Cannot Help With (Suggest Contacting Support)
- Billing issues, refunds, or payment problems
- Account access issues or password resets
- Bug reports or technical issues
- Feature requests
- Deleting or recovering data
- Business-specific compliance advice (recommend consulting qualified inspectors)
- Specific regulatory requirements for different countries

## Response Guidelines
- Be friendly, helpful, and concise
- Use step-by-step instructions when explaining how to do things
- All features are included in every plan - do NOT say any feature requires a specific plan
- If unsure, suggest contacting support rather than guessing
- Use British English spelling (organisation, colour, etc.)
- Format responses with markdown for readability (lists, bold for emphasis)
- NEVER mention "ADIPS", "PIPA", or "RPII" - use "Annual Inspection Certificate" or "Annual Independent Inspection" instead
- Use the exact tier names: "Starter", "Operator", "Professional", "Business"
- For 51+ items, advise the user to contact us for a custom plan
- When staff ask about features they can't access, explain that those are controller-only features

Remember: You're helping fairground operators manage their equipment documentation and compliance. Be accurate, practical and helpful! If you're not 100% certain about something, recommend contacting support.`;

interface ChatMessage {
  role: string;
  content: string;
}

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Check for authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in to use the help assistant.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('JWT verification failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user:', userId);

    // Rate limiting check using the existing check_rate_limit function
    const rateLimitKey = `help-chat:${userId}`;
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_key: rateLimitKey,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_ms: RATE_LIMIT_WINDOW_MS
    });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.warn('Rate limit exceeded for user:', userId);
      const retryAfterSeconds = Math.ceil((rateLimitResult.retry_after_ms || 60000) / 1000);
      return new Response(
        JSON.stringify({ 
          error: `You've reached the help chat limit. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds)
          } 
        }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { messages } = body;
    
    // Validate messages array exists
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate messages count
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: `Too many messages. Maximum ${MAX_MESSAGES} messages per conversation.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each message structure and content
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as ChatMessage;
      
      if (!msg.role || typeof msg.role !== 'string' || !['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(
          JSON.stringify({ error: `Invalid message role at index ${i}. Must be 'user', 'assistant', or 'system'.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (msg.content === undefined || msg.content === null || typeof msg.content !== 'string') {
        return new Response(
          JSON.stringify({ error: `Invalid message content at index ${i}. Content must be a string.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: `Message at index ${i} is too long. Maximum ${MAX_MESSAGE_LENGTH} characters per message.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing help chat request for user', userId, 'with', messages.length, 'messages');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map((msg: ChatMessage) => ({
            role: msg.role,
            content: msg.content,
          })),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Our AI assistant is busy right now. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service temporarily unavailable. Please try again later.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to get AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Help chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});