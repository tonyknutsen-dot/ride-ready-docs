/**
 * Auto-creates the next recurring compliance event when a document-linked event is completed.
 * Checks the linked document's recurrence settings and creates a future event if applicable.
 */
import { supabase } from '@/integrations/supabase/client';
import { addMonths, addDays, addYears } from 'date-fns';

interface AutoRecurrenceParams {
  completedEventId: string;
  completionDate: Date;
  userId: string;
}

/**
 * Calculate the next due date based on recurrence type.
 */
function calculateNextDueDate(
  fromDate: Date,
  recurrenceType: string,
  customDays?: number | null,
): Date {
  const now = new Date();
  let next: Date;

  switch (recurrenceType) {
    case 'annual':
      next = addYears(fromDate, 1);
      break;
    case '6_monthly':
      next = addMonths(fromDate, 6);
      break;
    case 'quarterly':
      next = addMonths(fromDate, 3);
      break;
    case 'monthly':
      next = addMonths(fromDate, 1);
      break;
    case 'custom':
      next = addDays(fromDate, customDays || 365);
      break;
    default:
      next = addYears(fromDate, 1);
  }

  // If calculated date is in the past, shift forward from today
  if (next <= now) {
    return calculateNextDueDate(now, recurrenceType, customDays);
  }

  return next;
}

/**
 * After completing a compliance event, check if it's linked to a document with
 * auto_create_event enabled, and if so, create the next recurring event.
 * 
 * Returns the new event ID if created, null otherwise.
 */
export async function maybeCreateRecurringEvent(
  params: AutoRecurrenceParams,
): Promise<string | null> {
  const { completedEventId, completionDate, userId } = params;

  try {
    // 1. Fetch the completed event to get ride_id and event details
    const { data: event, error: eventErr } = await supabase
      .from('compliance_events')
      .select('ride_id, event_name, event_type, category, reminder_days, reminder_enabled, advance_notice_days')
      .eq('id', completedEventId)
      .single();

    if (eventErr || !event) return null;

    // 2. Find documents linked to this event's ride + type that have auto_create_event
    //    We match by ride_id (or global) and document_type pattern
    let docQuery = supabase
      .from('documents')
      .select('id, recurrence_type, recurrence_interval_days, auto_create_event, document_name, is_global, ride_id, expires_at')
      .eq('auto_create_event', true)
      .eq('is_latest_version', true)
      .neq('recurrence_type', 'none');

    if (event.ride_id) {
      // Check for ride-specific OR global docs
      docQuery = docQuery.or(`ride_id.eq.${event.ride_id},is_global.eq.true`);
    } else {
      docQuery = docQuery.eq('is_global', true);
    }

    const { data: docs, error: docErr } = await docQuery;
    if (docErr || !docs || docs.length === 0) return null;

    // 3. For each matching document, check if a future event already exists
    let createdEventId: string | null = null;

    for (const doc of docs) {
      const nextDue = calculateNextDueDate(
        completionDate,
        doc.recurrence_type,
        doc.recurrence_interval_days,
      );
      const nextDueStr = nextDue.toISOString().split('T')[0];

      // Check for duplicate: same event_type, same ride, future due date
      const { data: existing } = await supabase
        .from('compliance_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', event.event_type)
        .eq('category', event.category)
        .eq('status', 'scheduled')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .maybeSingle();

      if (existing) continue; // Don't duplicate

      // 4. Create the next recurring event
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
        createdEventId = newEvent.id;

        // Link the completed event to the next one
        await supabase
          .from('compliance_events')
          .update({ next_event_id: newEvent.id })
          .eq('id', completedEventId);

        // Update document expiry to next due date
        await supabase
          .from('documents')
          .update({ expires_at: nextDueStr })
          .eq('id', doc.id);
      }

      break; // Only create one event per completion
    }

    return createdEventId;
  } catch (err) {
    console.error('Error creating recurring event:', err);
    return null;
  }
}
