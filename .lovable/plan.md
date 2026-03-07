# Page-Family Design System

## 1. Chooser Pages
**Pages:** Maintenance landing, Checks landing

**Rules:**
- `PageHeader` with module icon (40×40 circle, h-5 w-5 icon), bold title, [13px] subtitle
- Back button → `/overview`
- Single ghost action: "How it works" (`HelpCircle` icon, h-8 button, `text-[13px]`)
- `EquipmentSelector` with KPI strip, search, status filter chips, equipment cards
- Container: `space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8`
- **NOT allowed:** RegisterHeader, export buttons, PreviousReportsSection

## 2. Register Pages
**Pages:** Defect Register, Wind Speed Register, Maintenance (selected asset), Checks (selected asset/history)

**Rules — strict vertical order:**
1. `PageHeader` (provided by parent page for Maintenance/Checks, or self-contained for Defects/Wind)
2. **KPI cards** — *only* if the module has pass/fail aggregate metrics (Checks). Other registers omit this.
3. `RegisterHeader` containing in order:
   - Primary CTA (full-width mobile, auto desktop, `rounded-xl h-10 min-h-[44px]`)
   - `extraContent` slot (e.g. stop-use banner for Defects)
   - Search bar (`pl-9 h-10 rounded-xl text-[13px]`, `mt-3`)
   - Collapsible "Filters & date range" (`mt-3`) with shared date pickers + module-specific dropdowns
   - **"Clear all filters" link** inside filterContent when filters active (`text-[12px] font-medium text-primary`)
   - Export actions row (`mt-3`): **CSV then PDF**, both using `FileDown` icon (`h-4 w-4`), `variant="outline"`, `h-9 min-h-[40px] text-[13px] rounded-xl`
   - Result count + export hint (`mt-3`, `text-[13px]` + `text-[11px]`)
4. Records list (`space-y-3`)
5. `PreviousReportsSection` (shared component, View/Save to Device/Send/Copy Link action order)
- Container: `space-y-3` (all registers)

**Export icon rule:** All export buttons use `FileDown`, never `Download`.

## 3. Management Pages
**Pages:** Risk Assessments, Equipment, Documents, Send Documents

**Rules:**
- `PageHeader` with module icon, title, optional subtitle
- Module-specific content layout (grids, tabs, lists)
- No RegisterHeader required — each module owns its own filter/search patterns
- Consistent card styling: `rounded-xl border bg-card shadow-sm`

## 4. Utility Pages
**Pages:** Overview, Calendar

**Rules:**
- Minimal/no `PageHeader` (Overview uses custom dashboard header, Calendar uses `CalendarView`)
- Content-driven layouts, not form/list patterns
- `StaffAccountBanner` shown where applicable

---

## Deliberate Exceptions

| Exception | Page | Reason |
|-----------|------|--------|
| KPI cards above RegisterHeader | Checks history | Pass/fail aggregate metrics are core to the checks workflow and provide immediate operational awareness |
| `extraContent` stop-use banner | Defect Register | Safety-critical alert that must appear prominently before search/filters |
| Defects show status in subtitle | Defect Register | Open defect count is operationally critical — shown in PageHeader subtitle |

All other visual differences across pages within the same family are considered bugs.
