/**
 * Auto-creates the next annual compliance event when a compliance event is completed.
 * Uses the linked document's EXPIRY DATE (not completion date) to calculate next due.
 * Simple annual renewal: expiry + 1 year.
 */
import { supabase } from '@/integrations/supabase/client';
import { addYears } from 'date-fns';

interface AutoRecurrenceParams {
  completedEventId: string;
  userId: string;
}

/**
 * After completing a compliance event, check if it's linked to a document with
 * repeat_annually enabled. If so, create one next event due = document expiry + 1 year.
 *
 * Returns the new event ID if created, null otherwise.
 */
export async function maybeCreateRecurringEvent(
  params: AutoRecurrenceParams,
): Promise<string | null> {
  const { completedEventId, userId } = params;

  try {
    // 1. Fetch the completed event
    const { data: event, error: eventErr } = await supabase
      .from('compliance_events')
      .select('ride_id, event_name, event_type, category, reminder_days, reminder_enabled, advance_notice_days, due_date')
      .eq('id', completedEventId)
      .single();

    if (eventErr || !event) return null;

    // 2. Find documents with repeat_annually = true linked to this ride/global
    let docQuery = supabase
      .from('documents')
      .select('id, repeat_annually, document_name, is_global, ride_id, expires_at')
      .eq('repeat_annually', true)
      .eq('is_latest_version', true)
      .not('expires_at', 'is', null);

    if (event.ride_id) {
      docQuery = docQuery.or(`ride_id.eq.${event.ride_id},is_global.eq.true`);
    } else {
      docQuery = docQuery.eq('is_global', true);
    }

    const { data: docs, error: docErr } = await docQuery;
    if (docErr || !docs || docs.length === 0) return null;

    // 3. Use the first matching document's expiry date to calculate next due
    for (const doc of docs) {
      if (!doc.expires_at) continue;

      // Next due = document expiry + 1 year
      const expiryDate = new Date(doc.expires_at);
      const nextDue = addYears(expiryDate, 1);
      const nextDueStr = nextDue.toISOString().split('T')[0];

      // Prevent duplicates: check for existing future scheduled event of same type
      const { data: existing } = await supabase
        .from('compliance_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', event.event_type)
        .eq('category', event.category)
        .eq('status', 'scheduled')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .maybeSingle();

      if (existing) continue;

      // 4. Create ONE next event
      const { data: newEvent, error: insertErr } = await supabase
        .from('compliance_events')
        .insert({
          user_id: userId,
          ride_id: event.ride_id,
          event_name: event.event_name,
          event_type: event.event_type,
          category: event.category,
          due_date: nextDueStr,
          status: 'scheduled',
          is_recurring: true,
          auto_create_next: true,
          reminder_enabled: event.reminder_enabled ?? true,
          reminder_days: event.reminder_days ?? [30, 14, 7],
          advance_notice_days: event.advance_notice_days ?? 30,
          source_event_id: completedEventId,
        })
        .select('id')
        .single();

      if (!insertErr && newEvent) {
        // Link completed → next
        await supabase
          .from('compliance_events')
          .update({ next_event_id: newEvent.id })
          .eq('id', completedEventId);

        // Update document expiry to the new due date
        await supabase
          .from('documents')
          .update({ expires_at: nextDueStr })
          .eq('id', doc.id);

        return newEvent.id;
      }

      break; // Only ever create one event
    }

    return null;
  } catch (err) {
    console.error('Error creating recurring event:', err);
    return null;
  }
}
