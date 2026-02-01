

# Plan: Document Linking Awareness & Cascade Deletion

## Overview
This plan addresses two key user experience issues:
1. Users should be informed that checks, maintenance logs, and risk assessments automatically create entries in their Documents list
2. Deleting a check, maintenance record, or risk assessment should also delete any associated documents

## What Will Change

### 1. Add Informational Alerts to Forms

Add clear info banners to each creation form explaining that records will appear in Documents:

**Safety Checks (InspectionChecklist.tsx)**
- Add an info alert above the submit button: "When you complete this check, a PDF record will be automatically saved to your Documents under 'Check Records'."

**Maintenance Logger (MaintenanceLogger.tsx)**
- Add an info alert: "Attached photos and documents will be saved to your Documents list under 'Maintenance'. If you generate a report later, it will also appear there."

**Risk Assessments (RiskAssessmentManager.tsx)**
- Add info when creating: "When you download or email this assessment, a PDF copy will be saved to your Documents."

### 2. Update Onboarding Modals

Enhance the existing onboarding walkthroughs to mention document integration:

**ChecksOnboardingModal.tsx**
- Update Step 3 description to mention PDF auto-save to Documents

**MaintenanceOnboardingModal.tsx**
- Update Step 3 description to mention attachments and reports go to Documents

**RiskAssessmentOnboardingModal.tsx**
- Add mention that exported PDFs are saved to Documents

### 3. Implement Cascade Delete for Maintenance Records

When deleting a maintenance record:
- Fetch the `document_ids` array from the record
- Delete the corresponding document entries from `documents` table
- Delete the physical files from Supabase storage
- Then delete the maintenance record itself

**File: MaintenanceHistory.tsx - handleDelete function**

### 4. Implement Cascade Delete for Check Records

When check templates/checks are deleted, the associated Check Record PDFs should also be removed:
- Find documents where `document_type = 'Check Record'` and `ride_id` matches
- Delete from storage and documents table
- This applies to template archival/deletion scenarios

### 5. Implement Cascade Delete for Risk Assessments

Already partially handled - RAs only generate PDFs on download/email, not auto-save. But if we add auto-save later, ensure cascade delete is in place.

## Technical Details

### New Info Alert Component Pattern
```tsx
<Alert className="bg-primary/5 border-primary/20">
  <Info className="h-4 w-4 text-primary" />
  <AlertDescription className="text-sm">
    This record will be saved to your Documents list automatically.
  </AlertDescription>
</Alert>
```

### Updated Delete Function (Maintenance)
```tsx
const handleDelete = async (recordId: string) => {
  try {
    // 1. Fetch the record to get document_ids
    const { data: record } = await supabase
      .from('maintenance_records')
      .select('document_ids')
      .eq('id', recordId)
      .single();

    // 2. If there are linked documents, delete them
    if (record?.document_ids?.length) {
      // Get file paths
      const { data: docs } = await supabase
        .from('documents')
        .select('file_path')
        .in('id', record.document_ids);

      // Delete from storage
      if (docs?.length) {
        await supabase.storage
          .from('ride-documents')
          .remove(docs.map(d => d.file_path));
      }

      // Delete document records
      await supabase
        .from('documents')
        .delete()
        .in('id', record.document_ids);
    }

    // 3. Delete the maintenance record
    await supabase
      .from('maintenance_records')
      .delete()
      .eq('id', recordId);

    toast({ title: "Success", description: "Record and attachments deleted" });
    loadMaintenanceRecords();
  } catch (error) {
    // Error handling
  }
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/InspectionChecklist.tsx` | Add info alert near submit button |
| `src/components/MaintenanceLogger.tsx` | Add info alert about document saving |
| `src/components/RiskAssessmentManager.tsx` | Add info alert when creating/exporting |
| `src/components/MaintenanceHistory.tsx` | Update `handleDelete` to cascade delete documents |
| `src/components/ChecksOnboardingModal.tsx` | Update step 3 text |
| `src/components/MaintenanceOnboardingModal.tsx` | Update step 3 text |
| `src/components/RiskAssessmentOnboardingModal.tsx` | Update tip about exports |

## User Experience Flow

### After Implementation:

**Creating a Check:**
1. User completes safety check
2. User sees info alert: "A PDF record will be saved to Documents"
3. User submits check
4. PDF appears in Documents under "Check Records"

**Deleting a Maintenance Record:**
1. User clicks delete on maintenance record
2. Confirmation shows attachments will also be removed
3. System deletes: maintenance record + linked documents + storage files
4. Documents list no longer shows those attachments

## Benefits

- **Transparency**: Users understand where their data goes
- **Data Hygiene**: No orphaned documents when records are deleted
- **Audit Trail**: Users know their compliance records are preserved
- **Storage Efficiency**: Deleted records don't leave behind unused files

