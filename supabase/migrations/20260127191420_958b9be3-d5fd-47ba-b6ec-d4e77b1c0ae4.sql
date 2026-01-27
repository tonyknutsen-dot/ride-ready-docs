-- Update existing document notes to use "Checked by:" instead of "Inspector:"
UPDATE public.documents 
SET notes = REPLACE(notes, 'Inspector:', 'Checked by:')
WHERE notes LIKE '%Inspector:%';