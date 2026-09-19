// ═══════════════════════════════════════════════════════════════════════════
// SFDXHours.com - CustomListView
// ═══════════════════════════════════════════════════════════════════════════

import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeQuery from '@salesforce/apex/CustomListViewController.executeQuery';
import executeExportBatch from '@salesforce/apex/CustomListViewController.executeExportBatch';
import changeRecordsOwner from '@salesforce/apex/CustomListViewController.changeRecordsOwner';

// Constants
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_HOVER_COLOR = '#f0f7ff';
const DEFAULT_PILL_COLOR = { background: '#f3f3f3', text: '#514f4d' };
const DEBOUNCE_DELAY = 300;
const MIN_COLUMN_WIDTH = 60;
// Apex caps a page at 200 rows and SOQL caps OFFSET at 2000
const EXPORT_BATCH_SIZE = 200;
const MAX_SOQL_OFFSET = 2000;
// Ceiling for one CSV - each batch is a server round trip and the file is built in memory
const MAX_EXPORT_ROWS = 50000;

// File extension to icon mapping
const FILE_ICON_MAP = {
    // Documents
    pdf: 'doctype:pdf', doc: 'doctype:word', docx: 'doctype:word', word_x: 'doctype:word',
    xls: 'doctype:excel', xlsx: 'doctype:excel', xlsm: 'doctype:excel', csv: 'doctype:csv',
    ppt: 'doctype:ppt', pptx: 'doctype:ppt', txt: 'doctype:txt', rtf: 'doctype:rtf',
    // Images
    png: 'doctype:image', jpg: 'doctype:image', jpeg: 'doctype:image', gif: 'doctype:image',
    bmp: 'doctype:image', svg: 'doctype:image', webp: 'doctype:image', tiff: 'doctype:image',
    tif: 'doctype:image', ico: 'doctype:image',
    // Video
    mp4: 'doctype:video', avi: 'doctype:video', mov: 'doctype:video', wmv: 'doctype:video',
    mkv: 'doctype:video', webm: 'doctype:video',
    // Audio
    mp3: 'doctype:audio', wav: 'doctype:audio', ogg: 'doctype:audio', flac: 'doctype:audio', m4a: 'doctype:audio',
    // Archives
    zip: 'doctype:zip', rar: 'doctype:zip', '7z': 'doctype:zip', tar: 'doctype:zip', gz: 'doctype:zip',
    // Code
    html: 'doctype:html', htm: 'doctype:html', xml: 'doctype:xml',
    js: 'doctype:unknown', css: 'doctype:unknown', json: 'doctype:unknown',
    // Other
    eps: 'doctype:eps', ai: 'doctype:ai', psd: 'doctype:psd', gdoc: 'doctype:gdoc',
    gsheet: 'doctype:gsheet', gpres: 'doctype:gpres', keynote: 'doctype:keynote',
    pages: 'doctype:pages', numbers: 'doctype:numbers', visio: 'doctype:visio',
    link: 'doctype:link', library_folder: 'doctype:library_folder', folder: 'doctype:folder',
    default: 'doctype:attachment'
};

export default class CustomListView extends NavigationMixin(LightningElement) {
    // ═══════════════════════════════════════════════════════════════════════════
    // API Properties - Exposed to Lightning App Builder
    // ═══════════════════════════════════════════════════════════════════════════
    
    @api recordId;
    @api soqlQuery = '';
    @api listViewTitle = 'List View';
    @api listViewSubtitle = '';
    @api headerIconName = '';
    @api headerIconBackgroundColor = '';
    @api hoverRowColorHex = DEFAULT_HOVER_COLOR;
    @api displaySearchBox = false;
    @api displayActionsButton = false;
    @api recordCountPerPage = DEFAULT_PAGE_SIZE;
    @api defaultSortableColumn = '';
    @api allowUserSort = false;
    @api selectableRows = false;
    @api displayRowActions = false;
    @api enableCellCopy = false;
    @api bypassSharing = false;
    @api columnTextWrap = 'clip'; // 'clip' or 'wrap'
    @api disableExportPage = false;
    @api disableExportAll = false;
    
    // Column configurations (up to 10 columns)
    @api column1FieldApiName = ''; @api column1UiLabel = ''; @api column1DisplayAsPill = false;
    @api column1PillColors = ''; @api column1FilterValues = '';
    @api column2FieldApiName = ''; @api column2UiLabel = ''; @api column2DisplayAsPill = false;
    @api column2PillColors = ''; @api column2FilterValues = '';
    @api column3FieldApiName = ''; @api column3UiLabel = ''; @api column3DisplayAsPill = false;
    @api column3PillColors = ''; @api column3FilterValues = '';
    @api column4FieldApiName = ''; @api column4UiLabel = ''; @api column4DisplayAsPill = false;
    @api column4PillColors = ''; @api column4FilterValues = '';
    @api column5FieldApiName = ''; @api column5UiLabel = ''; @api column5DisplayAsPill = false;
    @api column5PillColors = ''; @api column5FilterValues = '';
    @api column6FieldApiName = ''; @api column6UiLabel = ''; @api column6DisplayAsPill = false;
    @api column6PillColors = ''; @api column6FilterValues = '';
    @api column7FieldApiName = ''; @api column7UiLabel = ''; @api column7DisplayAsPill = false;
    @api column7PillColors = ''; @api column7FilterValues = '';
    @api column8FieldApiName = ''; @api column8UiLabel = ''; @api column8DisplayAsPill = false;
    @api column8PillColors = ''; @api column8FilterValues = '';
    @api column9FieldApiName = ''; @api column9UiLabel = ''; @api column9DisplayAsPill = false;
    @api column9PillColors = ''; @api column9FilterValues = '';
    @api column10FieldApiName = ''; @api column10UiLabel = ''; @api column10DisplayAsPill = false;
    @api column10PillColors = ''; @api column10FilterValues = '';
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Reactive Properties
    // ═══════════════════════════════════════════════════════════════════════════

    records = [];
    totalRecords = 0;
    totalCountCapped = false; // true when Apex capped the count (shown as "10,000+")
    currentPage = 1;
    sortField = '';
    sortDirection = 'ASC';
    searchTerm = '';
    isLoading = false;
    errorMessage = '';
    @track fieldMetadata = {};
    @track selectedRecordIds = new Set();
    allSelectedOnPage = false;
    @track activeFilters = {};
    showChangeOwnerModal = false;
    newOwnerId = null;
    isChangingOwner = false;
    changeOwnerError = '';
    isFileObject = false;
    fileObjectType = null;
    lastRefreshed = null;

    // User-facing display preferences
    userTextWrap = null; // null = use admin default, 'clip' or 'wrap' = user override
    userPageSize = null; // null = use admin default from recordCountPerPage
    @track columnWidths = {}; // { fieldName: widthPx }
    tableWidth = null; // px, set while custom widths are active so columns keep their sizes
    _isResizing = false;
    _resizeField = null;
    _resizeStartX = 0;
    _resizeStartWidth = 0;
    _resizeStartTableWidth = 0;

    // Private properties
    _searchTimeout;
    _cachedColumnConfigs;
    _pillColorCache = new Map();
    _cachedDisplayFields = null;
    _cachedRecordsRef = null;
    _cachedDisplayRecords = null;
    _cachedSelectionRef = null;
    _columnsMemo = null;
    _loadToken = 0;
    _previousActiveElement = null;
    _changeOwnerIds = [];
    _changeOwnerClearsSelection = false;
    _resizeFrame = null;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Lifecycle Hooks
    // ═══════════════════════════════════════════════════════════════════════════
    
    connectedCallback() {
        this._cachedColumnConfigs = null;
        this._detectFileObject();
        if (this.defaultSortableColumn) {
            this.sortField = this.defaultSortableColumn;
        }
        this.loadData();
    }

    disconnectedCallback() {
        cancelAnimationFrame(this._resizeFrame);
        this._clearTimeouts();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - UI State
    // ═══════════════════════════════════════════════════════════════════════════
    
    get containerStyle() {
        return `--hover-color: ${this.hoverRowColorHex || DEFAULT_HOVER_COLOR};`;
    }
    
    get hasHeaderIcon() {
        return Boolean(this.headerIconName?.trim());
    }

    get isUtilityHeaderIcon() {
        return this.headerIconName?.trim().toLowerCase().startsWith('utility:');
    }

    get headerIconStyle() {
        const color = this.headerIconBackgroundColor?.trim();
        if (!color) return '';
        // Utility icons get a styled wrapper; standard/custom icons expose an SLDS styling hook
        return this.isUtilityHeaderIcon
            ? `background-color: ${color};`
            : `--slds-c-icon-color-background: ${color}; --sds-c-icon-color-background: ${color};`;
    }

    get totalRecordsLabel() {
        return this.totalCountCapped ? `${this.totalRecords.toLocaleString()}+` : String(this.totalRecords);
    }

    get recordCountLabel() {
        if (this.totalRecords === 0) return 'No items';
        return this.totalRecords === 1 ? '1 item' : `${this.totalRecordsLabel} items`;
    }

    get sortedByLabel() {
        if (!this.sortField) return '';
        const col = this.columns.find(c => c.fieldName === this.sortField);
        return col ? col.label : '';
    }
    
    get hasSubtitle() {
        return Boolean(this.listViewSubtitle?.trim());
    }
    
    get hasRecords() {
        return !this.errorMessage && this.records?.length > 0;
    }

    // Skeleton only when there is no table to keep on screen; reloads
    // (sort/page/filter) keep the current rows under a spinner instead
    get showSkeleton() {
        return this.isLoading && !this.hasRecords;
    }
    
    get showEmptyState() {
        return !this.isLoading && !this.errorMessage && (!this.records || this.records.length === 0);
    }

    get emptyStateIcon() {
        if (this.hasActiveFilters) return 'utility:filterList';
        if (this.searchTerm) return 'utility:search';
        return 'utility:table';
    }

    get emptyStateMessage() {
        if (this.hasActiveFilters && this.searchTerm) return 'No records match your filters and search';
        if (this.hasActiveFilters) return 'No records match the selected filters';
        if (this.searchTerm) return 'No records found';
        return 'No records found';
    }

    get emptyStateSubtext() {
        if (this.hasActiveFilters && this.searchTerm) return 'Try adjusting your filters or search criteria';
        if (this.hasActiveFilters) return 'Try changing or clearing your filter selections';
        if (this.searchTerm) return 'Try adjusting your search criteria';
        return '';
    }
    
    get showFileTypeColumn() {
        return this.isFileObject;
    }

    get activeTextWrap() {
        return this.userTextWrap !== null ? this.userTextWrap : this.columnTextWrap;
    }

    get tableCellClass() {
        return this.activeTextWrap === 'wrap' ? 'table-cell cell-wrap' : 'table-cell';
    }

    get isTextWrapped() {
        return this.activeTextWrap === 'wrap';
    }

    get wrapToggleLabel() {
        return this.isTextWrapped ? 'Clip Column Text' : 'Wrap Column Text';
    }

    get hasCustomColumnWidths() {
        return Object.keys(this.columnWidths).length > 0;
    }

    get noCustomColumnWidths() {
        return !this.hasCustomColumnWidths;
    }

    // An explicit table width stops fixed layout from redistributing spare
    // space across the columns the user did not touch
    get tableStyle() {
        return this.tableWidth ? `width: ${this.tableWidth}px;` : '';
    }

    get tableClass() {
        const base = 'slds-table slds-table_bordered slds-no-row-hover data-table';
        return this.hasCustomColumnWidths ? `${base} slds-table_fixed-layout data-table-fixed` : base;
    }

    get showExportPageOption() {
        return !this.disableExportPage;
    }

    get showExportAllOption() {
        return !this.disableExportAll;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - Selection
    // ═══════════════════════════════════════════════════════════════════════════
    
    get hasSelectedRecords() {
        return this.selectedRecordIds.size > 0;
    }
    
    get noSelectedRecords() {
        return this.selectedRecordIds.size === 0;
    }
    
    get selectedCountLabel() {
        const count = this.selectedRecordIds.size;
        if (count === 0) return '';
        return count === 1 ? '1 selected' : `${count} selected`;
    }
    
    get showSelectionActions() {
        return this.selectableRows && this.hasSelectedRecords;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - Filters
    // ═══════════════════════════════════════════════════════════════════════════
    
    get filterConfigurations() {
        const configs = this._getColumnConfigs();
        
        return configs
            .filter(config => config.field && config.filterValues)
            .map(config => {
                const values = config.filterValues.split(',').map(v => v.trim()).filter(Boolean);
                if (values.length === 0) return null;
                
                const metadata = this.fieldMetadata[config.field] || {};
                const selectedValues = this.activeFilters[config.field] || [];

                return {
                    fieldName: config.field,
                    label: config.label || metadata.label || config.field,
                    value: selectedValues[0] || '',
                    options: [
                        { label: 'All', value: '' },
                        ...values.map(val => ({ label: val, value: val }))
                    ]
                };
            })
            .filter(Boolean);
    }
    
    get hasQuickFilters() {
        return this._getColumnConfigs().some(config => config.field && config.filterValues);
    }
    
    get hasActiveFilters() {
        return Object.values(this.activeFilters).some(v => Array.isArray(v) && v.length > 0);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - Columns & Records
    // ═══════════════════════════════════════════════════════════════════════════
    
    get columns() {
        // Rebuilt only when an input changes - the getter is read several
        // times per render and on every resize frame
        const memo = this._columnsMemo;
        const { fieldMetadata, sortField, sortDirection, columnWidths } = this;
        if (memo && memo.fieldMetadata === fieldMetadata && memo.sortField === sortField &&
            memo.sortDirection === sortDirection && memo.columnWidths === columnWidths) {
            return memo.value;
        }

        const value = this._getColumnConfigs()
            .filter(config => config.field)
            .map(config => {
                const metadata = this.fieldMetadata[config.field] || {};
                const isSorted = this.sortField === config.field;
                const customWidth = this.columnWidths[config.field];

                return {
                    fieldName: config.field,
                    label: config.label || metadata.label || config.field,
                    type: metadata.type || 'STRING',
                    sortable: metadata.sortable !== false,
                    sortIcon: isSorted ? (this.sortDirection === 'ASC' ? 'utility:arrowup' : 'utility:arrowdown') : 'utility:sort',
                    sortButtonClass: isSorted ? 'sort-button active' : 'sort-button',
                    sortTitle: `Sort by ${config.label || metadata.label || config.field}`,
                    ariaSort: isSorted ? (this.sortDirection === 'ASC' ? 'ascending' : 'descending') : 'none',
                    displayAsPill: config.displayAsPill,
                    pillColorMap: this._parsePillColors(config.pillColors),
                    headerStyle: customWidth ? `width: ${customWidth}px; min-width: ${customWidth}px; max-width: ${customWidth}px;` : '',
                    hasCustomWidth: !!customWidth
                };
            });

        this._columnsMemo = { fieldMetadata, sortField, sortDirection, columnWidths, value };
        return value;
    }
    
    get displayRecords() {
        if (!this.records) return [];

        // Rebuild display fields only when the records array reference changes
        if (this._cachedRecordsRef !== this.records) {
            this._cachedRecordsRef = this.records;
            this._cachedDisplayRecords = null;
            // Resolve columns once - the getter rebuilds its config on every access
            const columns = this.columns;
            this._cachedDisplayFields = this.records.map(record => {
                const fileExtension = this.isFileObject ? this._getFileExtension(record) : '';
                const fileIcon = this.isFileObject ? this._getFileIcon(fileExtension) : '';

                return {
                    Id: record.Id,
                    displayFields: this._buildDisplayFields(record, columns),
                    fileExtension,
                    fileIcon,
                    contentDocumentId: this.isFileObject ? this._getContentDocumentId(record) : null,
                    contentVersionId: this.isFileObject ? this._getContentVersionId(record) : null,
                    hasFileIcon: this.isFileObject && fileIcon
                };
            });
        }

        // Selection state is re-applied only when the rows or the selection
        // Set (replaced on every change) differ, so unrelated re-renders such
        // as column resizing reuse the same row objects
        if (!this._cachedDisplayRecords || this._cachedSelectionRef !== this.selectedRecordIds) {
            this._cachedSelectionRef = this.selectedRecordIds;
            this._cachedDisplayRecords = this._cachedDisplayFields.map(cached => {
                const isSelected = this.selectedRecordIds.has(cached.Id);
                return {
                    ...cached,
                    isSelected,
                    rowClass: isSelected ? 'table-row selected-row' : 'table-row'
                };
            });
        }
        return this._cachedDisplayRecords;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - Pagination
    // ═══════════════════════════════════════════════════════════════════════════
    
    get currentPageSize() {
        return this.userPageSize || Number(this.recordCountPerPage) || DEFAULT_PAGE_SIZE;
    }

    get pageSizeValue() {
        return String(this.currentPageSize);
    }

    get pageSizeOptions() {
        const sizes = new Set([10, 25, 50, 100, this.currentPageSize]);
        return [...sizes]
            .sort((a, b) => a - b)
            .map(size => ({ label: String(size), value: String(size) }));
    }

    // SOQL rejects OFFSET > 2000, so paging stops at the last page that offset can reach
    get maxReachablePage() {
        return Math.floor(MAX_SOQL_OFFSET / this.currentPageSize) + 1;
    }

    get isPageDepthLimited() {
        return Math.ceil(this.totalRecords / this.currentPageSize) > this.maxReachablePage;
    }

    get totalPages() {
        return Math.min(Math.ceil(this.totalRecords / this.currentPageSize), this.maxReachablePage) || 1;
    }

    // Shown on the final reachable page so the list doesn't just appear to end
    get pageLimitHint() {
        if (!this.isPageDepthLimited || !this.isLastPage) return '';
        const reachable = (this.maxReachablePage * this.currentPageSize).toLocaleString();
        return `Only the first ${reachable} rows can be paged. Search, filter or export to reach the rest.`;
    }

    // Footer shows when paging is needed OR there are enough rows for the
    // page-size choice to matter
    get showPagination() {
        return this.totalRecords > Math.min(10, this.currentPageSize);
    }

    get isFirstPage() {
        return this.currentPage <= 1;
    }

    get isLastPage() {
        return this.currentPage >= this.totalPages;
    }

    get paginationStartRecord() {
        return ((this.currentPage - 1) * this.currentPageSize) + 1;
    }

    get paginationEndRecord() {
        const end = this.currentPage * this.currentPageSize;
        return Math.min(end, this.totalRecords);
    }

    // Skeleton placeholder rows shown while loading (capped at the 10 visible rows)
    get skeletonRows() {
        const columnCount = this._getColumnConfigs().filter(config => config.field).length || 3;
        const rowCount = Math.min(this.currentPageSize, 10);

        return Array.from({ length: rowCount }, (_, i) => ({
            key: `sk-${i}`,
            cells: Array.from({ length: columnCount }, (_, j) => `sk-${i}-${j}`)
        }));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Data Loading
    // ═══════════════════════════════════════════════════════════════════════════
    
    async loadData() {
        if (!this.soqlQuery) {
            this.errorMessage = 'Please configure a SOQL query for this component.';
            return;
        }
        
        // Only the latest request may apply its response - rapid sorting,
        // paging or typing can otherwise resolve out of order
        const token = ++this._loadToken;
        this.isLoading = true;
        this.errorMessage = '';
        
        try {
            const result = await executeQuery(this._buildQueryParams(this.currentPageSize, this.currentPage));
            if (token !== this._loadToken) return;
            
            if (result.success) {
                this.records = result.records || [];
                this.totalRecords = result.totalCount || 0;
                this.totalCountCapped = result.totalCountCapped === true;
                this.fieldMetadata = result.fieldMetadata || {};
                this.lastRefreshed = Date.now();
                this._updateAllSelectedState();
            } else {
                this._handleQueryError(result.errorMessage);
            }
        } catch (error) {
            if (token !== this._loadToken) return;
            this._handleQueryError(this._extractErrorMessage(error));
        } finally {
            if (token === this._loadToken) this.isLoading = false;
        }
    }

    _buildQueryParams(pageSize, pageNumber) {
        return {
            soqlQuery: this.soqlQuery,
            recordId: this.recordId || '',
            searchTerm: this.searchTerm || '',
            sortField: this.sortField || '',
            sortDirection: this.sortDirection,
            pageSize,
            pageNumber,
            filtersJson: JSON.stringify(this.activeFilters),
            bypassSharing: this.bypassSharing
        };
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Selection Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    
    handleSelectAll(event) {
        const isChecked = event.target.checked;
        
        this.records.forEach(record => {
            isChecked ? this.selectedRecordIds.add(record.Id) : this.selectedRecordIds.delete(record.Id);
        });
        
        this.selectedRecordIds = new Set(this.selectedRecordIds);
        this.allSelectedOnPage = isChecked;
    }
    
    handleRowSelect(event) {
        event.stopPropagation();
        const { id } = event.target.dataset;
        
        event.target.checked ? this.selectedRecordIds.add(id) : this.selectedRecordIds.delete(id);
        
        this.selectedRecordIds = new Set(this.selectedRecordIds);
        this._updateAllSelectedState();
    }
    
    clearSelection() {
        this.selectedRecordIds = new Set();
        this.allSelectedOnPage = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Quick Filter Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    
    handleFilterChange(event) {
        const field = event.target.dataset.field;
        const value = event.detail.value;

        if (!field) return;

        this._updateFilter(field, value ? [value] : []);
    }

    clearAllFilters() {
        this.activeFilters = {};
        this.currentPage = 1;
        this.loadData();
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Change Owner Modal Handlers
    // ═══════════════════════════════════════════════════════════════════════════

    get userFilter() {
        return {
            criteria: [{ fieldPath: 'IsActive', operator: 'eq', value: true }]
        };
    }

    get userDisplayInfo() {
        return { additionalFields: ['Email'] };
    }

    get userMatchingInfo() {
        return {
            primaryField: { fieldPath: 'Name' },
            additionalFields: [{ fieldPath: 'Email' }]
        };
    }

    get isConfirmOwnerChangeDisabled() {
        return !this.newOwnerId || this.isChangingOwner;
    }

    get changeOwnerButtonLabel() {
        return this.isChangingOwner ? 'Changing...' : 'Change Owner';
    }

    get changeOwnerCount() {
        return this._changeOwnerIds.length;
    }

    openChangeOwnerModal() {
        this._openChangeOwner(Array.from(this.selectedRecordIds), true);
    }

    // Row-level changes pass just that row, leaving the checkbox selection alone
    _openChangeOwner(recordIds, clearSelectionOnSuccess) {
        if (recordIds.length === 0) return;

        this._changeOwnerIds = recordIds;
        this._changeOwnerClearsSelection = clearSelectionOnSuccess;
        this.changeOwnerError = '';
        this._previousActiveElement = this.template.activeElement || document.activeElement;
        this.newOwnerId = null;
        this.showChangeOwnerModal = true;

        // Focus the modal's close button after render
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const closeBtn = this.template.querySelector('.slds-modal__close');
            if (closeBtn) closeBtn.focus();
        }, 0);
    }

    closeChangeOwnerModal() {
        if (this.isChangingOwner) return;
        this.showChangeOwnerModal = false;
        this.changeOwnerError = '';
        this.newOwnerId = null;

        if (this._previousActiveElement) {
            try { this._previousActiveElement.focus(); } catch (_) { /* element may be gone */ }
            this._previousActiveElement = null;
        }
    }

    handleModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeChangeOwnerModal();
            return;
        }

        if (event.key === 'Tab') {
            const modal = this.template.querySelector('.slds-modal__container');
            if (!modal) return;

            const focusable = modal.querySelectorAll(
                'button, [href], lightning-record-picker, lightning-button, lightning-button-icon, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = this.template.activeElement;

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    handleOwnerChange(event) {
        this.newOwnerId = event.detail.recordId || null;
    }

    async handleConfirmOwnerChange() {
        if (!this.newOwnerId || this._changeOwnerIds.length === 0) return;

        this.isChangingOwner = true;
        this.changeOwnerError = '';

        let result;
        try {
            result = await changeRecordsOwner({
                recordIds: this._changeOwnerIds,
                newOwnerId: this.newOwnerId
            });
        } catch (error) {
            result = { success: false, errorMessage: this._extractErrorMessage(error) };
        } finally {
            this.isChangingOwner = false;
        }

        if (!result.success && !(result.successCount > 0)) {
            // Nothing changed - keep the modal open so another owner can be picked
            this.changeOwnerError = result.errorMessage || 'Failed to change owner';
            return;
        }

        if (result.success) {
            this._showToast('Success', `Successfully changed owner for ${result.successCount} record(s)`, 'success');
        } else {
            this._showToast('Warning', result.errorMessage, 'warning');
        }
        if (this._changeOwnerClearsSelection) this.clearSelection();
        this.closeChangeOwnerModal();
        this.loadData();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Event Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    
    handleSearch(event) {
        const searchValue = event.target.value || '';

        clearTimeout(this._searchTimeout);
        this._searchTimeout = setTimeout(() => {
            if (this.searchTerm !== searchValue) {
                this.searchTerm = searchValue;
                this.currentPage = 1;
                this.loadData();
            }
        }, DEBOUNCE_DELAY);
    }
    
    handleSort(event) {
        const field = event.currentTarget.dataset.field;
        
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'ASC' ? 'DESC' : 'ASC';
        } else {
            this.sortField = field;
            this.sortDirection = 'ASC';
        }
        
        this.currentPage = 1;
        this.loadData();
    }
    
    async handleCopyCell(event) {
        event.stopPropagation();
        const value = event.currentTarget.dataset.value || '';

        try {
            await navigator.clipboard.writeText(value);
        } catch (e) {
            // Clipboard API unavailable (permissions/older browser) - legacy fallback
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }

        this._showToast('Copied', 'Cell value copied to clipboard', 'success');
    }

    handleLinkClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const { id } = event.currentTarget.dataset;
        if (id) this._navigateToRecord(id);
    }
    
    handleActionSelect(event) {
        const action = event.detail.value;

        switch (action) {
            case 'exportPage': this._exportToCSV(this.records); break;
            case 'exportAll': this._exportAllToCSV(); break;
            case 'changeOwner': this.openChangeOwnerModal(); break;
            case 'toggleWrap': this.handleToggleWrap(); break;
            case 'resetColumnWidths': this.handleResetColumnWidths(); break;
        }
    }

    handleToggleWrap() {
        this.userTextWrap = this.activeTextWrap === 'wrap' ? 'clip' : 'wrap';
    }

    handleResetColumnWidths() {
        this.columnWidths = {};
        this.tableWidth = null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Column Resize Handlers
    // ═══════════════════════════════════════════════════════════════════════════

    // Pointer events cover mouse, touch and pen; capturing the pointer on the
    // handle keeps move/up events coming even when the cursor leaves the header
    handleResizeStart(event) {
        if (event.button > 0) return;
        event.preventDefault();
        event.stopPropagation();

        const handle = event.currentTarget;
        const th = handle.closest('th');
        const table = handle.closest('table');
        if (!th || !table) return;

        // Freeze every column at its current rendered width first, so switching
        // to fixed layout moves nothing except the column being dragged
        const widths = {};
        this.template.querySelectorAll('th.resizable-header').forEach(header => {
            widths[header.dataset.col] = header.offsetWidth;
        });
        this.columnWidths = widths;
        this.tableWidth = table.offsetWidth;

        this._isResizing = true;
        this._resizeField = handle.dataset.field;
        this._resizeStartX = event.clientX;
        this._resizeStartWidth = th.offsetWidth;
        this._resizeStartTableWidth = table.offsetWidth;
        handle.setPointerCapture(event.pointerId);
    }

    handleResizeMove(event) {
        if (!this._isResizing) return;

        const newWidth = Math.max(MIN_COLUMN_WIDTH, this._resizeStartWidth + event.clientX - this._resizeStartX);
        const tableWidth = this._resizeStartTableWidth + newWidth - this._resizeStartWidth;
        const field = this._resizeField;

        // At most one re-render per frame, however fast pointermove fires
        cancelAnimationFrame(this._resizeFrame);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._resizeFrame = requestAnimationFrame(() => {
            this.columnWidths = { ...this.columnWidths, [field]: newWidth };
            this.tableWidth = tableWidth;
        });
    }

    handleResizeEnd() {
        this._isResizing = false;
        this._resizeField = null;
    }
    
    handleRowActionSelect(event) {
        const action = event.detail.value;
        const { recordId, contentDocumentId, contentVersionId } = event.target.dataset;
        
        switch (action) {
            case 'view': this._navigateToRecord(recordId); break;
            case 'edit': this._editRecord(recordId); break;
            case 'changeOwner': this._openChangeOwnerForSingleRecord(recordId); break;
            case 'viewFile': this._viewFile(contentDocumentId); break;
            case 'downloadFile': this._downloadFile(contentDocumentId, contentVersionId); break;
        }
    }
    
    handlePageSizeChange(event) {
        const size = parseInt(event.detail.value, 10);
        if (!size || size === this.currentPageSize) return;

        this.userPageSize = size;
        this.currentPage = 1;
        this.loadData();
    }

    // Pagination handlers
    handleFirstPage() { this.currentPage = 1; this.loadData(); }
    handlePreviousPage() { if (this.currentPage > 1) { this.currentPage--; this.loadData(); } }
    handleNextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.loadData(); } }
    handleLastPage() { this.currentPage = this.totalPages; this.loadData(); }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Private Methods - Helpers
    // ═══════════════════════════════════════════════════════════════════════════
    
    _getColumnConfigs() {
        if (!this._cachedColumnConfigs) {
            this._cachedColumnConfigs = [
                { field: this.column1FieldApiName, label: this.column1UiLabel, displayAsPill: this.column1DisplayAsPill, pillColors: this.column1PillColors, filterValues: this.column1FilterValues },
                { field: this.column2FieldApiName, label: this.column2UiLabel, displayAsPill: this.column2DisplayAsPill, pillColors: this.column2PillColors, filterValues: this.column2FilterValues },
                { field: this.column3FieldApiName, label: this.column3UiLabel, displayAsPill: this.column3DisplayAsPill, pillColors: this.column3PillColors, filterValues: this.column3FilterValues },
                { field: this.column4FieldApiName, label: this.column4UiLabel, displayAsPill: this.column4DisplayAsPill, pillColors: this.column4PillColors, filterValues: this.column4FilterValues },
                { field: this.column5FieldApiName, label: this.column5UiLabel, displayAsPill: this.column5DisplayAsPill, pillColors: this.column5PillColors, filterValues: this.column5FilterValues },
                { field: this.column6FieldApiName, label: this.column6UiLabel, displayAsPill: this.column6DisplayAsPill, pillColors: this.column6PillColors, filterValues: this.column6FilterValues },
                { field: this.column7FieldApiName, label: this.column7UiLabel, displayAsPill: this.column7DisplayAsPill, pillColors: this.column7PillColors, filterValues: this.column7FilterValues },
                { field: this.column8FieldApiName, label: this.column8UiLabel, displayAsPill: this.column8DisplayAsPill, pillColors: this.column8PillColors, filterValues: this.column8FilterValues },
                { field: this.column9FieldApiName, label: this.column9UiLabel, displayAsPill: this.column9DisplayAsPill, pillColors: this.column9PillColors, filterValues: this.column9FilterValues },
                { field: this.column10FieldApiName, label: this.column10UiLabel, displayAsPill: this.column10DisplayAsPill, pillColors: this.column10PillColors, filterValues: this.column10FilterValues }
            ];
        }
        return this._cachedColumnConfigs;
    }
    
    _buildDisplayFields(record, columns) {
        return columns.map((column, index) => {
            const fieldValue = this._getFieldValue(record, column.fieldName);
            const fieldType = column.type;
            const isPill = column.displayAsPill && fieldValue;
            const pillColors = isPill ? this._getPillColor(fieldValue, column.pillColorMap) : null;
            
            return {
                key: `${record.Id}-${column.fieldName}-${index}`,
                fieldName: column.fieldName,
                rawValue: fieldValue,
                displayValue: this._formatValue(fieldValue, fieldType),
                isLink: this._isLinkField(column) && !isPill,
                linkUrl: this._getLinkUrl(column, record),
                linkRecordId: this._getLinkRecordId(column, record),
                isBoolean: fieldType === 'BOOLEAN' && !isPill,
                booleanIcon: fieldValue ? 'utility:check' : 'utility:close',
                booleanClass: fieldValue ? 'boolean-true' : 'boolean-false',
                isCurrency: fieldType === 'CURRENCY' && !isPill,
                isPercent: fieldType === 'PERCENT' && !isPill,
                isDate: fieldType === 'DATE' && !isPill,
                isDateTime: fieldType === 'DATETIME' && !isPill,
                isEmail: fieldType === 'EMAIL' && !isPill,
                emailHref: fieldValue ? `mailto:${fieldValue}` : '',
                isPhone: fieldType === 'PHONE' && !isPill,
                phoneHref: fieldValue ? `tel:${fieldValue}` : '',
                isUrl: fieldType === 'URL' && !isPill,
                urlDisplay: this._truncateUrl(fieldValue),
                isPill,
                pillStyle: pillColors ? `background-color: ${pillColors.background}; color: ${pillColors.text};` : ''
            };
        });
    }
    
    _getFieldValue(record, fieldName) {
        if (!record || !fieldName) return '';
        
        if (fieldName.includes('.')) {
            return fieldName.split('.').reduce((value, part) => 
                value && typeof value === 'object' ? value[part] : '', record
            );
        }
        
        return record[fieldName];
    }
    
    _formatValue(value, type) {
        if (value === null || value === undefined) return '';
        if (type === 'BOOLEAN') return value ? 'Yes' : 'No';
        return String(value);
    }
    
    _isLinkField(column) {
        const metadata = this.fieldMetadata[column.fieldName] || {};
        return metadata.isNameField || column.fieldName === 'Name' || column.fieldName.endsWith('.Name');
    }
    
    _getLinkUrl(column, record) {
        const recordId = this._getLinkRecordId(column, record);
        return recordId ? `/${recordId}` : '';
    }
    
    _getLinkRecordId(column, record) {
        if (column.fieldName.includes('.')) {
            const relationshipName = column.fieldName.split('.')[0];
            const relatedRecord = record[relationshipName];
            return relatedRecord?.Id || '';
        }
        return record.Id;
    }
    
    _truncateUrl(url) {
        if (!url) return '';
        try {
            return new URL(url).hostname;
        } catch {
            return url.length > 30 ? `${url.substring(0, 30)}...` : url;
        }
    }
    
    _parsePillColors(colorString) {
        if (!colorString) return new Map();
        if (this._pillColorCache.has(colorString)) return this._pillColorCache.get(colorString);

        const colorMap = new Map();
        try {
            colorString.split(',').forEach(mapping => {
                const [value, color] = mapping.split(':').map(s => s.trim());
                if (value && color) colorMap.set(value.toLowerCase(), color);
            });
        } catch (e) {
            console.warn('Error parsing pill colors:', e);
        }

        this._pillColorCache.set(colorString, colorMap);
        return colorMap;
    }
    
    _getPillColor(value, colorMap) {
        if (!value || !colorMap?.size) return DEFAULT_PILL_COLOR;

        const color = colorMap.get(String(value).toLowerCase());
        if (!color) return DEFAULT_PILL_COLOR;

        return this._toSubtlePillColors(color);
    }

    // The configured colour becomes a soft tint (background) and a darker shade
    // (text) so pills stay legible and understated regardless of the hue chosen
    _toSubtlePillColors(hexColor) {
        const rgb = this._hexToRgb(hexColor);
        if (!rgb) return DEFAULT_PILL_COLOR;

        const mix = (channel, target, amount) => Math.round(channel + (target - channel) * amount);
        const background = `rgb(${mix(rgb.r, 255, 0.78)}, ${mix(rgb.g, 255, 0.78)}, ${mix(rgb.b, 255, 0.78)})`;
        const text = `rgb(${mix(rgb.r, 0, 0.52)}, ${mix(rgb.g, 0, 0.52)}, ${mix(rgb.b, 0, 0.52)})`;

        return { background, text };
    }

    _hexToRgb(hexColor) {
        let hex = String(hexColor).replace('#', '').trim();
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        if (!/^[0-9a-f]{6}$/i.test(hex)) return null;

        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    }
    
    _updateFilter(field, selections) {
        if (selections.length === 0) {
            delete this.activeFilters[field];
        } else {
            this.activeFilters[field] = selections;
        }
        
        this.activeFilters = { ...this.activeFilters };
        this.currentPage = 1;
        this.loadData();
    }
    
    _updateAllSelectedState() {
        this.allSelectedOnPage = this.records?.length > 0 && 
            this.records.every(record => this.selectedRecordIds.has(record.Id));
    }
    
    _handleQueryError(message) {
        this.errorMessage = message || 'An error occurred while loading data.';
        this.records = [];
        this.totalRecords = 0;
        this.totalCountCapped = false;
    }
    
    _extractErrorMessage(error) {
        if (typeof error === 'string') return error;
        return error?.body?.message || error?.message || 'An unexpected error occurred.';
    }
    
    _clearTimeouts() {
        clearTimeout(this._searchTimeout);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Private Methods - File Handling
    // ═══════════════════════════════════════════════════════════════════════════
    
    _detectFileObject() {
        if (!this.soqlQuery) return;
        
        const queryUpper = this.soqlQuery.toUpperCase();
        
        if (queryUpper.includes('FROM CONTENTVERSION')) {
            this.isFileObject = true;
            this.fileObjectType = 'ContentVersion';
        } else if (queryUpper.includes('FROM CONTENTDOCUMENTLINK')) {
            this.isFileObject = true;
            this.fileObjectType = 'ContentDocumentLink';
        } else if (queryUpper.includes('FROM CONTENTDOCUMENT')) {
            this.isFileObject = true;
            this.fileObjectType = 'ContentDocument';
        }
    }
    
    _getFileExtension(record) {
        if (!record) return '';
        
        const extensionFields = ['FileExtension', 'FileType', 'ContentDocument.FileExtension', 'ContentDocument.FileType'];
        for (const field of extensionFields) {
            const value = this._getFieldValue(record, field);
            if (value) return String(value).toLowerCase();
        }
        
        const titleFields = ['Title', 'Name', 'ContentDocument.Title', 'PathOnClient'];
        for (const field of titleFields) {
            const value = this._getFieldValue(record, field);
            if (value && typeof value === 'string' && value.includes('.')) {
                return value.split('.').pop().toLowerCase();
            }
        }
        
        return '';
    }
    
    _getFileIcon(extension) {
        if (!extension) return FILE_ICON_MAP.default;
        return FILE_ICON_MAP[extension.toLowerCase().replace('.', '')] || FILE_ICON_MAP.default;
    }
    
    _getContentDocumentId(record) {
        if (!record) return null;
        
        switch (this.fileObjectType) {
            case 'ContentDocument': return record.Id;
            case 'ContentDocumentLink': return record.ContentDocumentId || record.ContentDocument?.Id;
            case 'ContentVersion': return record.ContentDocumentId;
            default: return null;
        }
    }
    
    _getContentVersionId(record) {
        if (!record) return null;
        
        switch (this.fileObjectType) {
            case 'ContentVersion': return record.Id;
            case 'ContentDocument': return record.LatestPublishedVersionId;
            case 'ContentDocumentLink': return record.ContentDocument?.LatestPublishedVersionId;
            default: return null;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Private Methods - Navigation & Actions
    // ═══════════════════════════════════════════════════════════════════════════
    
    _navigateToRecord(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId, actionName: 'view' }
        });
    }
    
    _editRecord(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId, actionName: 'edit' }
        });
    }
    
    _viewFile(contentDocumentId) {
        if (!contentDocumentId) {
            this._showToast('Error', 'Unable to preview file - Content Document ID not found', 'error');
            return;
        }
        
        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: { pageName: 'filePreview' },
            state: { recordIds: contentDocumentId, selectedRecordId: contentDocumentId }
        });
    }
    
    _downloadFile(contentDocumentId, contentVersionId) {
        if (!contentDocumentId && !contentVersionId) {
            this._showToast('Error', 'Unable to download file - file ID not found', 'error');
            return;
        }
        
        const downloadUrl = contentVersionId 
            ? `/sfc/servlet.shepherd/version/download/${contentVersionId}`
            : `/sfc/servlet.shepherd/document/download/${contentDocumentId}`;
        
        window.open(downloadUrl, '_blank');
    }
    
    // Acts on the one row without disturbing the user's checkbox selection
    _openChangeOwnerForSingleRecord(recordId) {
        this._openChangeOwner([recordId], false);
    }

    async _exportAllToCSV() {
        if (this.totalRecords === 0) {
            this._showToast('Warning', 'No records to export', 'warning');
            return;
        }

        this.isLoading = true;
        try {
            // Lists that OFFSET can fully reach export in the current sort order;
            // anything larger switches to keyset batches, which come back in Id order
            const needsKeyset = this.totalCountCapped || this.totalRecords > MAX_SOQL_OFFSET + EXPORT_BATCH_SIZE;
            const allRecords = needsKeyset ? await this._fetchAllByKeyset() : await this._fetchAllByOffset();

            this._exportToCSV(allRecords);
            if (allRecords.length >= MAX_EXPORT_ROWS) {
                this._showToast('Warning', `Export is limited to the first ${MAX_EXPORT_ROWS.toLocaleString()} records`, 'warning');
            }
        } catch (error) {
            this._showToast('Error', 'Failed to fetch all records for export', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async _fetchAllByOffset() {
        const allRecords = [];
        const lastPage = Math.ceil(this.totalRecords / EXPORT_BATCH_SIZE);
        for (let page = 1; page <= lastPage; page++) {
            // eslint-disable-next-line no-await-in-loop
            const result = await executeQuery(this._buildQueryParams(EXPORT_BATCH_SIZE, page));
            if (!result.success) throw new Error(result.errorMessage);
            allRecords.push(...(result.records || []));
            if (!result.records || result.records.length < EXPORT_BATCH_SIZE) break;
        }
        return allRecords;
    }

    async _fetchAllByKeyset() {
        const allRecords = [];
        let afterId = '';
        while (allRecords.length < MAX_EXPORT_ROWS) {
            // eslint-disable-next-line no-await-in-loop
            const result = await executeExportBatch({
                soqlQuery: this.soqlQuery,
                recordId: this.recordId || '',
                searchTerm: this.searchTerm || '',
                filtersJson: JSON.stringify(this.activeFilters),
                bypassSharing: this.bypassSharing,
                afterId,
                batchSize: EXPORT_BATCH_SIZE
            });
            if (!result.success) throw new Error(result.errorMessage);

            const batch = result.records || [];
            allRecords.push(...batch);
            if (batch.length < EXPORT_BATCH_SIZE) break;
            afterId = batch[batch.length - 1].Id;
        }
        return allRecords;
    }

    _exportToCSV(recordsToExport) {
        if (!recordsToExport?.length) {
            this._showToast('Warning', 'No records to export', 'warning');
            return;
        }

        try {
            const columns = this.columns;
            const headers = columns.map(col => `"${col.label}"`).join(',');
            const rows = recordsToExport.map(record =>
                columns.map(col => {
                    const value = this._getFieldValue(record, col.fieldName);
                    const formatted = this._formatValue(value, col.type);
                    return `"${String(formatted).replace(/"/g, '""')}"`;
                }).join(',')
            );

            // BOM + content for proper UTF-8 handling in Excel
            const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
            const fileName = `${this.listViewTitle.replace(/\s+/g, '_')}_export.csv`;

            // Data URI approach for Lightning Locker Service / LWS compatibility
            const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', fileName);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this._showToast('Success', `Exported ${recordsToExport.length} record(s)`, 'success');
        } catch (error) {
            this._showToast('Error', 'Failed to export data', 'error');
        }
    }
    
    _showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}