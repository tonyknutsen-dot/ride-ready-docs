/**
 * Auto-creates the next annual compliance event when a compliance event is completed.
 * Simple: if the linked document has repeat_annually = true, create one event +1 year.
 */
import { supabase } from '@/integrations/supabase/client';
import { addYears } from 'date-fns';

interface AutoRecurrenceParams {
  completedEventId: string;
  completionDate: Date;
  userId: string;
}

/**
 * After completing a compliance event, check if it's linked to a document with
 * repeat_annually enabled, and if so, create one next annual event.
 *
 * Returns the new event ID if created, null otherwise.
 */
export async function maybeCreateRecurringEvent(
  params: AutoRecurrenceParams,
): Promise<string | null> {
  const { completedEventId, completionDate, userId } = params;

  try {
    // 1. Fetch the completed event
    const { data: event, error: eventErr } = await supabase
      .from('compliance_events')
      .select('ride_id, event_name, event_type, category, reminder_days, reminder_enabled, advance_notice_days, due_date')
      .eq('id', completedEventId)
      .single();

    if (eventErr || !event) return null;

    // 2. Find documents linked to this event that have repeat_annually = true
    let docQuery = supabase
      .from('documents')
      .select('id, repeat_annually, document_name, is_global, ride_id')
      .eq('repeat_annually', true)
      .eq('is_latest_version', true);

    if (event.ride_id) {
      docQuery = docQuery.or(`ride_id.eq.${event.ride_id},is_global.eq.true`);
    } else {
      docQuery = docQuery.eq('is_global', true);
    }

    const { data: docs, error: docErr } = await docQuery;
    if (docErr || !docs || docs.length === 0) return null;

    // 3. For the first matching document, create one annual event if none exists
    for (const doc of docs) {
      // Calculate next due: previous due date + 1 year (or from completion if no due_date)
      const baseDateStr = event.due_date || completionDate.toISOString().split('T')[0];
      const baseDate = new Date(baseDateStr);
      let nextDue = addYears(baseDate, 1);

      // If next due is in the past, shift from today
      if (nextDue <= new Date()) {
        nextDue = addYears(new Date(), 1);
      }

      const nextDueStr = nextDue.toISOString().split('T')[0];

      // Check for existing future scheduled event of same type — prevent duplicates
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
