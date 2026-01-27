
# Plan: Managing Large Volumes of Safety Check Records

## Problem Statement

As operators perform daily, monthly, and yearly checks, the number of Safety Check Record PDFs in the document list will grow rapidly. A busy operator could accumulate hundreds of check records within months. Currently:

- The document list shows all check records without filtering options
- The batch send page doesn't have date-range filtering for check records
- There's no efficient way to select "all checks from January 2026" to email to a council

---

## Proposed Solution

### 1. Add Filtering to Document List

Add a filter bar specifically when viewing Safety Check Records that allows:
- **Date range selection**: Quick presets (This Month, Last 30 Days, This Year) plus custom date picker
- **Check type filter**: Pre-Opening, Daily, Monthly, Yearly, or All
- **Search**: By inspector name or notes

**User Experience:**
- Filters appear above the Safety Check Records section when that category is expanded
- Reduces clutter for users with few records (filters only show when 10+ check records exist)
- Remembers last filter settings in session

### 2. Enhance Batch Send Page for Check Records

Add a dedicated "Safety Check Records" section with:
- **Date range picker**: Select records from a specific period
- **Select All in Range**: One-click selection of all checks within the filtered date range
- **Visual grouping by month**: Makes it easier to see what you're sending
- **Count and size preview**: Shows "42 check records selected (8.2MB)"

### 3. Add "Export Check Records" Quick Action

Add a prominent button in the Safety Check Records section:
- Opens a streamlined dialog specifically for sharing check records
- Pre-filters to show only check record documents
- Date range selector with common presets
- Direct email integration using the existing batch send infrastructure

---

## Technical Implementation

### Files to Modify

**1. `src/components/DocumentList.tsx`**
- Add state for check record filters (date range, check type, search)
- Add a collapsible filter panel that appears for the Safety Check Records group
- Filter the documents array before rendering when filters are active
- Add "Send Check Records" button that opens dedicated dialog

**2. `src/pages/BatchSendDocuments.tsx`**
- Add date range filter for documents of type "Check Record"
- Group check records by month for easier selection
- Add "Select All Check Records" option with date range

**3. New Component: `src/components/SendCheckRecordsDialog.tsx`**
- Streamlined dialog for sending safety check records
- Date range selection with presets
- Preview of selected checks with count
- Uses existing `send-batch-documents` edge function

### Database Considerations

No database changes needed. The existing `documents` table already stores:
- `document_type` = "Check Record"
- `uploaded_at` timestamp for filtering
- `document_name` contains date and check type info

### Filtering Logic

Check records can be identified by:
```text
document_type: "Check Record" OR
document_type: "check_record" OR  
file_path contains: "/check-records/"
```

Date filtering uses the `uploaded_at` column since that reflects when the check was performed and filed.

---

## User Flow Example

**Scenario:** Council requests all safety checks for January 2026

1. User goes to Documents page or "Send Documents" page
2. Expands/views Safety Check Records section
3. Clicks filter or "Send Check Records" button
4. Selects "Custom Range" and picks January 1-31, 2026
5. System shows "24 check records found (12 Pre-Opening, 8 Daily, 4 Monthly)"
6. User clicks "Select All" or individually picks records
7. Enters council email address
8. Clicks Send - documents are emailed as attachments

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| DocumentList.tsx | Add filter bar for check records, "Send Check Records" button |
| BatchSendDocuments.tsx | Add date range filtering, month grouping for check records |
| New: SendCheckRecordsDialog.tsx | Streamlined dialog for sending check records by date range |

This solution leverages the existing batch send infrastructure while providing the specific filtering operators need when dealing with regulatory bodies and councils.
