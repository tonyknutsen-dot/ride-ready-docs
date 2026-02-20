
-- Update the generate_compliance_record_number function to support new doc type codes
-- TL = Equipment Timeline, CH = Checks History, IC = Inspection Checklist, RA = Risk Assessment
-- The existing function already supports any string for p_doc_type, so we just need to ensure
-- the sequence table can handle the new codes. No schema change needed since doc_type is text.
-- This migration is a no-op confirmation that TL, CH, IC, RA are valid doc_type values.

-- Verify the function signature handles arbitrary doc types (it does, since doc_type is text)
-- No changes needed to the function itself, just confirming support.
SELECT 1;
