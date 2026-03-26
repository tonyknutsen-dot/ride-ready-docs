import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface ImportRequest {
  signup_ids: string[];
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Use getUser() — the standard, reliable auth verification method
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    console.log('User ID:', userId);

    // Create service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { signup_ids } = await req.json() as ImportRequest;

    if (!signup_ids || !Array.isArray(signup_ids) || signup_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'signup_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Importing signups:', signup_ids);

    // Fetch the signups to import
    const { data: signups, error: signupsError } = await adminClient
      .from('early_access_signups')
      .select('id, email, name')
      .in('id', signup_ids)
      .is('imported_to_marketing_at', null);

    if (signupsError) {
      console.error('Fetch signups error:', signupsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch signups' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!signups || signups.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, skipped: signup_ids.length, errors: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which emails already exist in marketing_contacts
    const emails = signups.map(s => s.email.toLowerCase());
    const { data: existingContacts } = await adminClient
      .from('marketing_contacts')
      .select('email')
      .in('email', emails);

    const existingEmails = new Set((existingContacts || []).map(c => c.email.toLowerCase()));

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const importedIds: string[] = [];

    for (const signup of signups) {
      const emailLower = signup.email.toLowerCase();
      
      if (existingEmails.has(emailLower)) {
        console.log('Skipping duplicate email:', signup.email);
        skipped++;
        // Still mark as imported since it exists in marketing
        importedIds.push(signup.id);
        continue;
      }

      // Insert into marketing_contacts with the admin's user_id
      const { error: insertError } = await adminClient
        .from('marketing_contacts')
        .insert({
          email: signup.email,
          name: signup.name,
          tags: ['early-access'],
          notes: 'Imported from early access signup',
          user_id: userId,
          is_subscribed: true
        });

      if (insertError) {
        console.error('Insert error for', signup.email, ':', insertError);
        errors++;
      } else {
        console.log('Imported:', signup.email);
        imported++;
        importedIds.push(signup.id);
        existingEmails.add(emailLower);
      }
    }

    // Only mark as imported AFTER successful DB writes
    if (importedIds.length > 0) {
      const { error: updateError } = await adminClient
        .from('early_access_signups')
        .update({ imported_to_marketing_at: new Date().toISOString() })
        .in('id', importedIds);

      if (updateError) {
        console.error('Update timestamp error:', updateError);
      }
    }

    console.log('Import complete:', { imported, skipped, errors });

    return new Response(
      JSON.stringify({ imported, skipped, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
