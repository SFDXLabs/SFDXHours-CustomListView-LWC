# SFDXLabs | Custom List View

A modern, highly configurable Lightning Web Component that replaces the standard Salesforce related list and list view with an enhanced, feature-rich UI. Designed for admins who want full control through the Lightning App Builder and end users who want a polished, interactive experience.

**Modern UI** \
<img width="1327" height="517" alt="image" src="https://github.com/user-attachments/assets/adad99bc-4dc9-4543-afdc-f42bb10dc569" />

**Selectable rows with visual indicators** \
<img width="1331" height="521" alt="image" src="https://github.com/user-attachments/assets/59619258-0d5a-4136-bfb7-d1e23c06a0c4" />

**Intelligent file type detection** \
<img width="1325" height="471" alt="image" src="https://github.com/user-attachments/assets/74c60dce-f8a9-4466-a1ad-9b206cac8120" />

**Highly customisable** \
<img width="582" height="597" alt="522584586-cbda8b87-f4b5-41f1-8aef-0212b1474c57" src="https://github.com/user-attachments/assets/68a269f7-7eaf-405c-a87c-a40fb56b2044" />

---

## Features

### Core Features
- **Modern UI Design**: Clean, polished interface built on SLDS components and styling hooks, so fonts, borders, radius and accent colours follow the org's theme (including SLDS 2)
- **Native-Style Header**: Optional header icon plus an "N items • Sorted by X • Updated Y ago" line, matching the standard list view
- **Fully Configurable**: All settings exposed through Lightning App Builder properties
- **Dynamic SOQL Queries**: Support for any object with `{recordId}` and `{currentUserId}` placeholders
- **Up to 10 Configurable Columns**: Each with custom labels and automatic field type detection
- **Smart Search**: Real-time filtering across text fields with debouncing
- **Intelligent File Detection**: Automatically detects ContentVersion, ContentDocument, and ContentDocumentLink queries to display file type icons and offer View/Download actions
- **Sortable Columns**: Click-to-sort with ascending/descending toggle
- **Pagination**: Configurable records per page (1-200) with first/prev/next/last navigation and a user-facing "per page" selector
- **Built for Large Lists**: Capped totals ("10,000+ items"), a graceful paging limit and an Export All that is not bound by the SOQL `OFFSET` ceiling (see [Large Lists](#large-lists))
- **Smooth Loading**: Skeleton rows on first load; sorting, paging and filtering keep the current rows on screen under a spinner instead of collapsing the table
- **Field Type Formatting**: Automatic formatting for dates, currency, percentages, booleans, emails, phones, and URLs
- **Relationship Field Support**: Display fields from related objects (e.g., `Account.Name`)
- **Export to CSV**: Export current page or all records (up to 50,000 per file), with UTF-8/BOM support for Excel
- **Cell Copy to Clipboard**: Optional copy icon on cell hover
- **Bypass Sharing Rules**: Optional "without sharing" mode for elevated data visibility (read-only - see [Data Visibility](#data-visibility))
- **Responsive Design**: Adapts to desktop and mobile layouts
- **Accessibility**: Native table semantics, ARIA labels and sort state, labelled icon buttons, and a focus-trapped modal

### User-Facing Display Controls
- **Column Text Wrap Toggle**: Users can switch between clipped (truncated with ellipsis) and wrapped (multi-line) text directly from the Actions menu, without needing admin intervention
- **Column Resizing**: Users can drag the right edge of any column header (mouse, touch or pen) to resize just that column
- **Reset Column Widths**: Always available in the Actions menu to restore the default widths
- **Rows Per Page**: Footer selector (10 / 25 / 50 / 100, plus the admin default)
- **Refresh**: One-click reload next to the Actions menu

### Selection & Bulk Actions
- **Selectable Rows**: Optional checkbox column for multi-record selection
- **Select All**: Header checkbox to select/deselect all records on current page
- **Change Owner**: Bulk action to reassign ownership on selected records
- **User Search**: Standard record picker searching active users by name or email
- **Selection Counter**: Visual indicator showing number of selected records

### Row Actions
- **Row Actions Menu**: Per-row dropdown menu with quick actions
- **View Record**: Navigate to record detail page
- **Edit Record**: Navigate to record edit page
- **Change Owner**: Change owner for an individual record (leaves any checkbox selection untouched)
- **View File**: Preview a file directly (file objects only)
- **Download File**: Download a file directly (file objects only)

### Quick Filters
- **Filter Bar**: Dropdown filters for any column, shown below the header
- **Configurable Values**: Define which values appear in each filter
- **Combined Filtering**: Multiple filters work together (AND logic between filters)
- **Clear Filters**: Set a filter back to "All", or clear all filters at once

### Pill / Badge Display
- **Colored Pills**: Display picklist values as SLDS badges
- **Custom Color Mapping**: Map specific values to hex colors
- **Always Legible**: Each mapped colour is rendered as a soft tint with a darker shade of the same hue for the text

---

## Installation

### Deploy to Salesforce

1. Clone this repository or copy the files
2. Deploy using Salesforce CLI:

```bash
sf project deploy start --source-dir force-app
```

Or use VS Code with Salesforce Extensions:
1. Right-click on the `force-app` folder
2. Select "SFDX: Deploy Source to Org"

### Files Structure

```
force-app/
└── main/
    └── default/
        ├── classes/
        │   ├── CustomListViewController.cls
        │   ├── CustomListViewController.cls-meta.xml
        │   ├── CustomListViewControllerTest.cls
        │   └── CustomListViewControllerTest.cls-meta.xml
        └── lwc/
            └── customListView/
                ├── customListView.html
                ├── customListView.js
                ├── customListView.css
                └── customListView.js-meta.xml
```

---

## Configuration Properties

Add the component to any Lightning Record Page, App Page, or Home Page and configure it using the following properties.

### Core Configuration

| Property | Description | Type | Example |
|----------|-------------|------|---------|
| **SOQL Query** | Base query to return records. Use `{recordId}` for current record context or `{currentUserId}` for the logged-in user | Text | `SELECT Id, Name, Email FROM Contact WHERE AccountId = {recordId}` |
| **List View Title** | Title displayed at the top of the component | Text | `Related Contacts` |
| **List View Subtitle** | Smaller grey text displayed below the title | Text | `Showing all active contacts for this account` |
| **Header Icon** | Optional SLDS icon shown next to the title, like the standard list view header | Text | `standard:case` |
| **Header Icon Background Color (Hex)** | Optional background for the header icon. Leave blank for the icon's default SLDS colour | Text | `#0176d3` |

### Query Placeholders

| Placeholder | Description | Example Usage |
|-------------|-------------|---------------|
| `{recordId}` | Replaced with the current record's ID (on record pages) | `WHERE AccountId = {recordId}` |
| `{currentUserId}` | Replaced with the logged-in user's ID | `WHERE OwnerId = {currentUserId}` |

### Data Visibility

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| **Bypass Sharing Rules** | Show all records regardless of sharing rules (without sharing mode). Use with caution. | Boolean | `false` |

- Applies to everything that reads data: the list, the record count, search, quick filters and both CSV exports.
- It is **read-only**. **Change Owner always enforces sharing**, so users can see bypassed records but cannot reassign records they have no edit access to (they get an access error for those records).

### UI Customization

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| **Column Text Overflow** | Default text overflow behaviour. Users can toggle this at runtime via the Actions menu. | `clip` / `wrap` | `clip` |
| **Hover Row Color (Hex)** | Hex color for row hover highlight | Text | `#f0f7ff` |
| **Display Search Box** | Show/hide the search input | Boolean | `true` |
| **Display Actions Button** | Show/hide the Refresh button and the actions dropdown menu (Export, Change Owner, Wrap/Clip toggle, Reset Column Widths) | Boolean | `true` |
| **Disable Export Page to CSV** | Hide the "Export Page to CSV" option from the actions menu | Boolean | `false` |
| **Disable Export All to CSV** | Hide the "Export All to CSV" option from the actions menu | Boolean | `false` |
| **Selectable Rows** | Enable checkbox selection and bulk actions (Change Owner) | Boolean | `false` |
| **Display Row Actions** | Show per-row action menu (View, Edit, Change Owner, and file actions) | Boolean | `true` |
| **Enable Cell Copy to Clipboard** | Show a small copy icon on cell hover that copies the cell's value | Boolean | `false` |

### Pagination & Sorting

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| **Records Per Page** | Default records per page (1-200). Users can change it with the "per page" selector in the footer | Number | `20` |
| **Default Sort Column** | Field API name for default sorting | Text | _(blank)_ |
| **Allow User Sorting** | Allow users to change sort by clicking column headers | Boolean | `true` |

#### Large Lists

The component stays usable on objects with hundreds of thousands of rows:

| Area | Behaviour |
|------|-----------|
| **Record count** | Totals are capped at 10,000 and shown as "10,000+ items", so large objects load without hitting the SOQL row limit. Counts up to and including 10,000 are exact. |
| **Paging** | Reaches the first 2,000 rows plus one page (the SOQL `OFFSET` ceiling) - page 101 at 20 per page, page 41 at 50. "Last page" goes to that page, which shows a hint to search, filter or export to reach the rest. |
| **Export All** | Not bound by the 2,000-row ceiling. Lists that paging can fully reach (up to 2,200 rows) export in the current sort order. Larger lists export in batches of 200 using keyset paging, in **record Id order**, up to 50,000 rows per file (a warning is shown if the limit is hit). |

The footer appears once a list has more than 10 records (or more than one page).

### Column Configuration (1-10)

Each column has five properties:

| Property | Description | Example |
|----------|-------------|---------|
| **Column X - Field API Name** | API name of the field to display | `Custom_Field__c`, `Account.Name` |
| **Column X - Custom Label** | Override the default field label | `Customer Name` |
| **Column X - Display as Pill** | Show value as a colored pill/badge | `true` |
| **Column X - Pill Color Mapping** | Map values to hex colors | `Won:#2e844a,Lost:#ba0517` |
| **Column X - Quick Filter Values** | Enable a filter dropdown with comma-separated values | `Open,Closed,Pending` |

### Pill Color Mapping Format

Format: `Value1:#hex1,Value2:#hex2`

- Values are case-insensitive
- Unmapped values display with a default gray pill
- The hex colour is not used as-is: the pill background is a soft tint of it and the text a darker shade, so any hue stays legible
- Use 3- or 6-digit hex codes (`#2e844a`, `#fa0`); anything else falls back to the gray pill

**Examples:**
```
Won:#2e844a,Lost:#ba0517,Pending:#fe9339
Active:#0176d3,Inactive:#706e6b
High:#ba0517,Medium:#fe9339,Low:#2e844a
```

### Quick Filter Configuration

To enable quick filters for a column:

1. Set the **Quick Filter Values** property with comma-separated values
2. The filter dropdown appears in a filter bar below the header
3. The label above each filter uses the Custom Label (if set) or the field's default label

**Example:**
```
Column 2 - Field API Name: Status__c
Column 2 - Custom Label: Status
Column 2 - Quick Filter Values: New,Open,In Progress,Closed,On Hold
```

**Filter Behaviour:**
- Each filter is a single-select dropdown; choose **All** to remove that filter
- Multiple filters use AND logic between them (e.g., `Status = 'Open' AND Priority = 'High'`)
- Filters combine with the search box and the query's own `WHERE` clause
- Filters reset pagination to page 1
- A **Clear All Filters** button appears in the filter bar (and in the empty state) while any filter is active

---

## User-Facing Display Controls

These features are available to end users at runtime through the Actions dropdown menu and the table header, without requiring admin configuration changes.

### Column Text Wrap Toggle

Users can switch between **Clip** (text truncated with ellipsis) and **Wrap** (text wraps to multiple lines) via the Actions menu. The admin-configured **Column Text Overflow** value is used as the initial default.

| Actions Menu Label | Current State | Result |
|--------------------|---------------|--------|
| "Wrap Column Text" | Clipped | Switches to wrapped |
| "Clip Column Text" | Wrapped | Switches to clipped |

### Column Resizing

Users can drag the right edge of any column header to resize it (mouse, touch or pen). A thin divider appears on header hover to mark the handle and turns into a highlighted bar while dragging.

- Minimum column width is 60px
- Only the dragged column changes: all other columns are frozen at their current widths, and the table grows or shrinks (scrolling horizontally if needed)
- Resizing is per-session (resets on page reload)

### Reset Column Widths

The Actions menu always contains a **Reset Column Widths** option (disabled until a column has been resized). Clicking it restores all columns to their default auto-sized widths. Requires **Display Actions Button** to be enabled.

### Rows Per Page

The footer has a **per page** selector offering 10, 25, 50 and 100 rows, plus the admin-configured **Records Per Page** value. Changing it returns to page 1. The choice is per-session.

### Refresh & Loading

The **Refresh** button (next to the Actions menu) reloads the list, and the header shows when it was last updated. The first load shows skeleton rows; after that, sorting, paging, filtering and refreshing keep the current rows visible under a spinner, so the table height and scroll position don't jump.

---

## Usage Examples

### Example 1: Contacts on Account Page

**SOQL Query:**
```sql
SELECT Id, Name, Email, Phone, Title, Department FROM Contact WHERE AccountId = {recordId}
```

**Configuration:**
- List View Title: `Related Contacts`
- Records Per Page: `15`
- Default Sort Column: `Name`
- Selectable Rows: `true`
- Column 1 Field: `Name`
- Column 2 Field: `Title`
- Column 3 Field: `Email`
- Column 4 Field: `Phone`
- Column 5 Field: `Department`

### Example 2: Opportunities with Status Pills and Filters

**SOQL Query:**
```sql
SELECT Id, Name, StageName, Amount, CloseDate, Account.Name FROM Opportunity WHERE OwnerId = {currentUserId}
```

**Configuration:**
- List View Title: `My Opportunities`
- Hover Row Color: `#e8f5e9`
- Selectable Rows: `true`
- Column 1 Field: `Name`
- Column 2 Field: `Account.Name`, Label: `Account`
- Column 3 Field: `StageName`, Label: `Stage`
  - Display as Pill: `true`
  - Pill Colors: `Closed Won:#2e844a,Closed Lost:#ba0517,Qualification:#0176d3,Proposal:#fe9339,Negotiation:#9050e9`
  - Quick Filter Values: `Qualification,Proposal,Negotiation,Closed Won,Closed Lost`
- Column 4 Field: `Amount`
- Column 5 Field: `CloseDate`, Label: `Close Date`

### Example 3: Cases with Priority Filters

**SOQL Query:**
```sql
SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate FROM Case WHERE IsClosed = false
```

**Configuration:**
- Display Search Box: `true`
- Selectable Rows: `true`
- Display Row Actions: `true`
- Records Per Page: `25`
- Column 1 Field: `CaseNumber`
- Column 2 Field: `Subject`
- Column 3 Field: `Status`
  - Quick Filter Values: `New,Working,Escalated,Closed`
- Column 4 Field: `Priority`
  - Display as Pill: `true`
  - Pill Colors: `High:#ba0517,Medium:#fe9339,Low:#2e844a`
  - Quick Filter Values: `High,Medium,Low`
- Column 5 Field: `CreatedDate`, Label: `Created`

### Example 4: Tasks Owned by Current User

**SOQL Query:**
```sql
SELECT Id, Subject, Status, Priority, ActivityDate, Who.Name FROM Task WHERE OwnerId = {currentUserId} AND IsClosed = false
```

**Configuration:**
- List View Title: `My Open Tasks`
- Selectable Rows: `true`
- Column 1 Field: `Subject`
- Column 2 Field: `Who.Name`, Label: `Related To`
- Column 3 Field: `Status`
  - Quick Filter Values: `Not Started,In Progress,Waiting on someone else,Deferred`
- Column 4 Field: `Priority`
- Column 5 Field: `ActivityDate`, Label: `Due Date`

### Example 5: Files / Attachments on a Record

**SOQL Query:**
```sql
SELECT Id, ContentDocument.Title, ContentDocument.FileExtension, ContentDocument.ContentSize, ContentDocument.CreatedDate FROM ContentDocumentLink WHERE LinkedEntityId = {recordId}
```

**Configuration:**
- List View Title: `Files & Attachments`
- Column 1 Field: `ContentDocument.Title`, Label: `File Name`
- Column 2 Field: `ContentDocument.FileExtension`, Label: `Type`
- Column 3 Field: `ContentDocument.ContentSize`, Label: `Size`
- Column 4 Field: `ContentDocument.CreatedDate`, Label: `Uploaded`

The component automatically detects ContentVersion, ContentDocument, and ContentDocumentLink objects and enables:
- File type icons in a dedicated column
- "View File" and "Download File" row actions

---

## Supported Field Types

The component automatically detects and formats these field types:

| Field Type | Rendering |
|------------|-----------|
| Text/String | Plain text |
| Name | Clickable link to record |
| Boolean | Check/X icon |
| Currency | Formatted with currency symbol |
| Percent | Formatted with % symbol |
| Date | Localized date format (e.g., Jan 15, 2025) |
| DateTime | Localized date and time |
| Email | Clickable mailto link |
| Phone | Clickable tel link |
| URL | Clickable link (displays domain) |
| Picklist | Plain text (or colored pill if enabled) |
| Relationship | Clickable link to related record |

---

## Bulk Actions

### Change Owner

When **Selectable Rows** is enabled:

1. Select one or more records using the checkboxes
2. Click the **Change Owner** button in the header or the Actions menu (or use the row action menu for a single record)
3. Search for a user by name or email
4. Select the new owner from the results
5. Click **Change Owner** to update all selected records

**Details:**
- Works with any object that has an `OwnerId` field
- User search is a standard record picker over active users, matching on name or email
- The row action changes only that row and leaves the checkbox selection as it was; the bulk action clears the selection on success
- If nothing could be updated, the error is shown inside the modal so a different owner can be chosen
- Partial success closes the modal, reloads the list and reports how many records succeeded/failed
- The modal cannot be dismissed while the update is in flight
- Modal includes Escape-to-close, focus trapping and focus restoration
- Always runs with sharing enforced, even when **Bypass Sharing Rules** is on

---

## Row Actions

When **Display Row Actions** is enabled (default), each row shows a dropdown menu:

| Action | Description |
|--------|-------------|
| **View File** | Preview the file (file objects only) |
| **Download File** | Download the file (file objects only) |
| **View Record** | Navigate to the record's detail page |
| **Edit Record** | Navigate to the record's edit page |
| **Change Owner** | Open the Change Owner modal for this record |

File-specific actions only appear when the SOQL query targets ContentVersion, ContentDocument, or ContentDocumentLink.

---

## Customization

### Changing Colors

Colours resolve from SLDS global styling hooks, so the component follows the org's theme automatically. Each custom property in `customListView.css` has a fallback used when the theme doesn't provide the hook - change the fallback, or replace the whole value to pin a colour:

```css
:host {
    --primary-color: var(--slds-g-color-accent-2, #0176d3);            /* Links and active elements */
    --primary-hover: var(--slds-g-color-accent-3, #014486);            /* Link hover state */
    --text-primary: var(--slds-g-color-on-surface-3, #181818);         /* Main text color */
    --text-secondary: var(--slds-g-color-on-surface-2, #514f4d);       /* Secondary text */
    --text-muted: var(--slds-g-color-on-surface-1, #747474);           /* Muted/subtle text */
    --border-color: var(--slds-g-color-border-1, #e5e5e5);             /* Card, header and footer borders */
    --row-divider-color: var(--slds-g-color-neutral-base-95, #f3f3f3); /* Lines between rows (use -90 for stronger) */
    --border-radius: var(--slds-g-radius-border-4, 0.75rem);           /* Corner rounding */
    --background-light: var(--slds-g-color-surface-container-1, #fafaf9); /* Table header / filter bar */
    --background-white: var(--slds-g-color-surface-1, #ffffff);        /* Card and row background */
    --selection-color: var(--slds-g-color-brand-base-95, #eef4ff);     /* Selected row background */
    --selection-border: var(--primary-color);                          /* Selected row left edge */
}
```

The row hover colour is set per component instance with the **Hover Row Color (Hex)** property.

### Adding New Bulk Actions

1. Add a new menu item in `customListView.html` (inside the actions menu):

```html
<lightning-menu-item value="myBulkAction" label="My Bulk Action" disabled={noSelectedRecords}></lightning-menu-item>
```

2. Handle the action in `customListView.js`:

```javascript
handleActionSelect(event) {
    const action = event.detail.value;

    switch (action) {
        // ... existing cases ...
        case 'myBulkAction':
            this.handleMyBulkAction();
            break;
    }
}

handleMyBulkAction() {
    const selectedIds = Array.from(this.selectedRecordIds);
    // Your custom logic here
}
```

### Adding New Row Actions

1. Add a menu item in the row actions template:

```html
<lightning-menu-item
    value="myRowAction"
    label="My Action"
    icon-name="utility:your_icon">
</lightning-menu-item>
```

2. Handle the action in `handleRowActionSelect`:

```javascript
case 'myRowAction':
    this.handleMyRowAction(recordId);
    break;
```

---

## Troubleshooting

### "Could not determine object name from query"
- Ensure your SOQL query follows standard syntax with `FROM ObjectName`

### Records not appearing
- Check that the query returns data in Developer Console
- Verify the column Field API Names match fields in your SELECT clause
- Ensure the running user has access to the object and fields

### {recordId} not working
- This only works on Record Pages
- Ensure the record page has a valid record context

### {currentUserId} not working
- Verify the SOQL syntax: `WHERE OwnerId = {currentUserId}` (no quotes needed)

### Search not finding records
- Search only works on text-compatible fields (String, Email, Phone, URL, Picklist)
- The field must be included in your SOQL query

### Quick filters not showing
- Ensure you've entered values in the **Quick Filter Values** property
- Values should be comma-separated (e.g., `Open,Closed,Pending`)
- The filter bar only appears when at least one column has filter values configured

### Change Owner not working
- The object must have an `OwnerId` field
- The user must have permission to modify records
- The target user must be active
- With **Bypass Sharing Rules** on, users can see records they cannot edit - Change Owner still enforces sharing and reports an access error for those records

### Filters returning no results
- Check that filter values exactly match the field values in your data
- Verify the field API name is correct
- Check the browser console for any error messages

### Column resizing not working
- Column resize handles are on the right edge of each column header - hover the header to see the divider
- Ensure you are dragging from the header row, not from data cells
- The file-type, checkbox and Actions columns are fixed width and cannot be resized
- **Reset Column Widths** lives in the Actions menu, so it needs **Display Actions Button** enabled

### Record count shows "10,000+"
- Expected for lists with more than 10,000 matching records - the count is capped to stay within SOQL limits. Narrow the list with search, quick filters or the query's `WHERE` clause for an exact total

### Can't page past a certain page
- SOQL cannot skip more than 2,000 rows, so paging stops at the last reachable page and shows a hint. Use search or filters to narrow the list, or **Export All to CSV** to get every row

### Export All is not in the on-screen sort order
- Lists over 2,200 rows export in record Id order (keyset paging), not the current sort. Sort the CSV in your spreadsheet, or narrow the list below 2,200 rows to keep the sort order
- A single export is limited to 50,000 rows

---

## License

MIT License - feel free to use and modify for your projects.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
