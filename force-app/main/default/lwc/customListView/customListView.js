// ═══════════════════════════════════════════════════════════════════════════
// SFDXHours.com - CustomListView
// ═══════════════════════════════════════════════════════════════════════════

import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeQuery from '@salesforce/apex/CustomListViewController.executeQuery';
import changeRecordsOwner from '@salesforce/apex/CustomListViewController.changeRecordsOwner';
import searchUsers from '@salesforce/apex/CustomListViewController.searchUsers';

// Constants
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_HOVER_COLOR = '#f0f7ff';
const DEFAULT_PILL_COLOR = { background: '#e5e5e5', text: '#444444' };
const DEBOUNCE_DELAY = 300;
const MIN_USER_SEARCH_LENGTH = 2;

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
    @api hoverRowColorHex = DEFAULT_HOVER_COLOR;
    @api displaySearchBox = false;
    @api displayActionsButton = false;
    @api recordCountPerPage = DEFAULT_PAGE_SIZE;
    @api defaultSortableColumn = '';
    @api allowUserSort = false;
    @api selectableRows = false;
    @api displayRowActions = false;
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
    openFilterDropdown = null;
    showChangeOwnerModal = false;
    userSearchTerm = '';
    userSearchResults = [];
    selectedNewOwner = null;
    isSearchingUsers = false;
    isChangingOwner = false;
    isFileObject = false;
    fileObjectType = null;

    // User-facing display preferences
    userTextWrap = null; // null = use admin default, 'clip' or 'wrap' = user override
    @track columnWidths = {}; // { fieldName: widthPx }
    _isResizing = false;
    _resizeField = null;
    _resizeStartX = 0;
    _resizeStartWidth = 0;
    _boundHandleResizeMove = null;
    _boundHandleResizeEnd = null;

    // Private properties
    _searchTimeout;
    _userSearchTimeout;
    _boundHandleDocumentClick;
    _cachedColumnConfigs;
    _pillColorCache = new Map();
    _cachedDisplayFields = null;
    _cachedRecordsRef = null;
    _previousActiveElement = null;
    
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

        this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
        document.addEventListener('click', this._boundHandleDocumentClick);

        this._boundHandleResizeMove = this._handleResizeMove.bind(this);
        this._boundHandleResizeEnd = this._handleResizeEnd.bind(this);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._boundHandleDocumentClick);
        document.removeEventListener('mousemove', this._boundHandleResizeMove);
        document.removeEventListener('mouseup', this._boundHandleResizeEnd);
        this._clearTimeouts();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - UI State
    // ═══════════════════════════════════════════════════════════════════════════
    
    get containerStyle() {
        return `--hover-color: ${this.hoverRowColorHex || DEFAULT_HOVER_COLOR};`;
    }
    
    get recordCountLabel() {
        if (this.totalRecords === 0) return 'No records';
        return this.totalRecords === 1 ? '1 record' : `${this.totalRecords} records`;
    }
    
    get hasSubtitle() {
        return Boolean(this.listViewSubtitle?.trim());
    }
    
    get hasRecords() {
        return !this.isLoading && !this.errorMessage && this.records?.length > 0;
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

    get tableClass() {
        return this.hasCustomColumnWidths ? 'data-table data-table-fixed' : 'data-table';
    }

    get showExportPageOption() {
        return !this.disableExportPage;
    }

    get showExportAllOption() {
        return !this.disableExportAll;
    }

    get showAnyExportOption() {
        return !this.disableExportPage || !this.disableExportAll;
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
    
    get selectedCount() {
        return this.selectedRecordIds.size;
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
                    options: values.map(val => ({
                        label: val,
                        value: val,
                        isChecked: selectedValues.includes(val),
                        fieldName: config.field,
                        optionKey: `${config.field}-${val}`
                    })),
                    selectedValues,
                    buttonLabel: this._getFilterButtonLabel(selectedValues),
                    hasSelections: selectedValues.length > 0,
                    isOpen: this.openFilterDropdown === config.field
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
        return this._getColumnConfigs()
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
    }
    
    get displayRecords() {
        if (!this.records) return [];

        // Rebuild display fields only when the records array reference changes
        if (this._cachedRecordsRef !== this.records) {
            this._cachedRecordsRef = this.records;
            this._cachedDisplayFields = this.records.map(record => {
                const fileExtension = this.isFileObject ? this._getFileExtension(record) : '';
                const fileIcon = this.isFileObject ? this._getFileIcon(fileExtension) : '';

                return {
                    Id: record.Id,
                    displayFields: this._buildDisplayFields(record),
                    fileExtension,
                    fileIcon,
                    contentDocumentId: this.isFileObject ? this._getContentDocumentId(record) : null,
                    contentVersionId: this.isFileObject ? this._getContentVersionId(record) : null,
                    hasFileIcon: this.isFileObject && fileIcon
                };
            });
        }

        // Selection state is applied on every render (lightweight)
        return this._cachedDisplayFields.map(cached => ({
            ...cached,
            isSelected: this.selectedRecordIds.has(cached.Id),
            rowClass: this.selectedRecordIds.has(cached.Id) ? 'table-row selected-row' : 'table-row'
        }));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - Pagination
    // ═══════════════════════════════════════════════════════════════════════════
    
    get totalPages() {
        return Math.ceil(this.totalRecords / this.recordCountPerPage) || 1;
    }
    
    get showPagination() {
        return this.totalRecords > this.recordCountPerPage;
    }
    
    get isFirstPage() {
        return this.currentPage <= 1;
    }
    
    get isLastPage() {
        return this.currentPage >= this.totalPages;
    }
    
    get paginationStartRecord() {
        return ((this.currentPage - 1) * this.recordCountPerPage) + 1;
    }
    
    get paginationEndRecord() {
        const end = this.currentPage * this.recordCountPerPage;
        return Math.min(end, this.totalRecords);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Computed Properties - Change Owner Modal
    // ═══════════════════════════════════════════════════════════════════════════
    
    get hasUserSearchResults() {
        return this.userSearchResults?.length > 0;
    }
    
    get isConfirmOwnerChangeDisabled() {
        return !this.selectedNewOwner || this.isChangingOwner;
    }
    
    get changeOwnerButtonLabel() {
        return this.isChangingOwner ? 'Changing...' : 'Change Owner';
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Data Loading
    // ═══════════════════════════════════════════════════════════════════════════
    
    async loadData() {
        if (!this.soqlQuery) {
            this.errorMessage = 'Please configure a SOQL query for this component.';
            return;
        }
        
        this.isLoading = true;
        this.errorMessage = '';
        
        try {
            const result = await executeQuery({
                soqlQuery: this.soqlQuery,
                recordId: this.recordId || '',
                searchTerm: this.searchTerm || '',
                sortField: this.sortField || '',
                sortDirection: this.sortDirection,
                pageSize: this.recordCountPerPage,
                pageNumber: this.currentPage,
                filtersJson: JSON.stringify(this.activeFilters),
                bypassSharing: this.bypassSharing
            });
            
            if (result.success) {
                this.records = result.records || [];
                this.totalRecords = result.totalCount || 0;
                this.fieldMetadata = result.fieldMetadata || {};
                this._updateAllSelectedState();
            } else {
                this._handleQueryError(result.errorMessage);
            }
        } catch (error) {
            this._handleQueryError(this._extractErrorMessage(error));
        } finally {
            this.isLoading = false;
        }
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
    
    toggleFilterDropdown(event) {
        event.stopPropagation();
        const { field } = event.currentTarget.dataset;
        this.openFilterDropdown = this.openFilterDropdown === field ? null : field;
    }
    
    handleFilterOptionChange(event) {
        event.stopPropagation();
        const { field, value } = event.target.dataset;
        const isChecked = event.target.checked;
        
        if (!field || !value) return;
        
        let selections = [...(this.activeFilters[field] || [])];
        
        if (isChecked && !selections.includes(value)) {
            selections.push(value);
        } else if (!isChecked) {
            selections = selections.filter(v => v !== value);
        }
        
        this._updateFilter(field, selections);
    }
    
    clearFilterSelection(event) {
        event.stopPropagation();
        const { field } = event.currentTarget.dataset;
        this._updateFilter(field, []);
    }
    
    clearAllFilters() {
        this.activeFilters = {};
        this.openFilterDropdown = null;
        this.currentPage = 1;
        this.loadData();
    }
    
    closeFilterDropdowns() {
        if (this.openFilterDropdown) {
            this.openFilterDropdown = null;
        }
    }
    
    stopPropagation(event) {
        event.stopPropagation();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Change Owner Modal Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    
    openChangeOwnerModal() {
        this._previousActiveElement = this.template.activeElement || document.activeElement;
        this.showChangeOwnerModal = true;
        this.userSearchTerm = '';
        this.userSearchResults = [];
        this.selectedNewOwner = null;

        // Focus the modal's close button after render
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const closeBtn = this.template.querySelector('.slds-modal__close');
            if (closeBtn) closeBtn.focus();
        }, 0);
    }

    closeChangeOwnerModal() {
        this.showChangeOwnerModal = false;
        this.userSearchTerm = '';
        this.userSearchResults = [];
        this.selectedNewOwner = null;
        this.isChangingOwner = false;

        // Restore focus to the element that opened the modal
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
                'button, [href], lightning-input, lightning-button, lightning-button-icon, [tabindex]:not([tabindex="-1"])'
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

    handleUserSearch(event) {
        const searchValue = event.target.value || '';
        this.userSearchTerm = searchValue;

        clearTimeout(this._userSearchTimeout);

        if (searchValue.length < MIN_USER_SEARCH_LENGTH) {
            this.userSearchResults = [];
            return;
        }

        this._userSearchTimeout = setTimeout(() => this._searchForUsers(searchValue), DEBOUNCE_DELAY);
    }
    
    handleUserSelect(event) {
        const userId = event.currentTarget.dataset.id;
        const selectedUser = this.userSearchResults.find(u => u.Id === userId);
        
        if (selectedUser) {
            this.selectedNewOwner = selectedUser;
            this.userSearchResults = this.userSearchResults.map(user => ({
                ...user,
                isSelected: user.Id === userId,
                userItemClass: user.Id === userId ? 'user-item user-item-selected' : 'user-item'
            }));
        }
    }
    
    async handleConfirmOwnerChange() {
        if (!this.selectedNewOwner || this.selectedRecordIds.size === 0) return;
        
        this.isChangingOwner = true;
        
        try {
            const result = await changeRecordsOwner({
                recordIds: Array.from(this.selectedRecordIds),
                newOwnerId: this.selectedNewOwner.Id
            });
            
            if (result.success) {
                this._showToast('Success', `Successfully changed owner for ${result.successCount} record(s)`, 'success');
                this.clearSelection();
                this.closeChangeOwnerModal();
                this.loadData();
            } else {
                this._showToast('Error', result.errorMessage || 'Failed to change owner', 'error');
            }
        } catch (error) {
            this._showToast('Error', this._extractErrorMessage(error), 'error');
        } finally {
            this.isChangingOwner = false;
        }
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
    
    handleRowClick(event) {
        if (event.target.type === 'checkbox') return;
        
        const { id } = event.currentTarget.dataset;
        if (id) this._navigateToRecord(id);
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
            case 'refresh': this.loadData(); break;
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
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Column Resize Handlers
    // ═══════════════════════════════════════════════════════════════════════════

    handleResizeMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();

        const field = event.currentTarget.dataset.field;
        const th = event.currentTarget.closest('th');
        if (!th) return;

        this._isResizing = true;
        this._resizeField = field;
        this._resizeStartX = event.clientX;
        this._resizeStartWidth = th.offsetWidth;

        document.addEventListener('mousemove', this._boundHandleResizeMove);
        document.addEventListener('mouseup', this._boundHandleResizeEnd);
    }

    _handleResizeMove(event) {
        if (!this._isResizing) return;

        const diff = event.clientX - this._resizeStartX;
        const newWidth = Math.max(60, this._resizeStartWidth + diff);

        this.columnWidths = { ...this.columnWidths, [this._resizeField]: newWidth };
    }

    _handleResizeEnd() {
        this._isResizing = false;
        this._resizeField = null;

        document.removeEventListener('mousemove', this._boundHandleResizeMove);
        document.removeEventListener('mouseup', this._boundHandleResizeEnd);
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
    
    _buildDisplayFields(record) {
        return this.columns.map((column, index) => {
            const fieldValue = this._getFieldValue(record, column.fieldName);
            const fieldType = column.type;
            const isPill = column.displayAsPill && fieldValue;
            const pillColors = isPill ? this._getPillColor(fieldValue, column.pillColorMap) : null;
            
            return {
                key: `${record.Id}-${column.fieldName}-${index}`,
                fieldName: column.fieldName,
                rawValue: fieldValue,
                displayValue: this._formatValue(fieldValue, fieldType),
                isLink: this._isLinkField(column, record) && !isPill,
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
    
    _isLinkField(column, record) {
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
        
        return { background: color, text: this._getContrastingTextColor(color) };
    }
    
    _getContrastingTextColor(hexColor) {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#181818' : '#ffffff';
    }
    
    _getFilterButtonLabel(selectedValues) {
        if (!selectedValues?.length) return 'All';
        return selectedValues.length === 1 ? selectedValues[0] : `${selectedValues.length} selected`;
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
    }
    
    _extractErrorMessage(error) {
        if (typeof error === 'string') return error;
        return error?.body?.message || error?.message || 'An unexpected error occurred.';
    }
    
    _clearTimeouts() {
        clearTimeout(this._searchTimeout);
        clearTimeout(this._userSearchTimeout);
    }
    
    _handleDocumentClick(event) {
        if (this.openFilterDropdown) {
            const filterBar = this.template.querySelector('.filter-bar');
            if (filterBar && !filterBar.contains(event.target)) {
                this.openFilterDropdown = null;
            }
        }
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
    
    _openChangeOwnerForSingleRecord(recordId) {
        this.selectedRecordIds = new Set([recordId]);
        this.openChangeOwnerModal();
    }
    
    async _searchForUsers(searchTerm) {
        this.isSearchingUsers = true;
        
        try {
            const results = await searchUsers({ searchTerm });
            this.userSearchResults = results.map(user => ({
                Id: user.Id,
                Name: user.Name,
                Email: user.Email,
                SmallPhotoUrl: user.SmallPhotoUrl,
                Title: user.Title || '',
                isSelected: this.selectedNewOwner?.Id === user.Id,
                userItemClass: this.selectedNewOwner?.Id === user.Id ? 'user-item user-item-selected' : 'user-item'
            }));
        } catch (error) {
            console.error('Error searching users:', error);
            this.userSearchResults = [];
        } finally {
            this.isSearchingUsers = false;
        }
    }
    
    async _exportAllToCSV() {
        if (this.totalRecords === 0) {
            this._showToast('Warning', 'No records to export', 'warning');
            return;
        }

        this.isLoading = true;
        try {
            const result = await executeQuery({
                soqlQuery: this.soqlQuery,
                recordId: this.recordId || '',
                searchTerm: this.searchTerm || '',
                sortField: this.sortField || '',
                sortDirection: this.sortDirection,
                pageSize: this.totalRecords,
                pageNumber: 1,
                filtersJson: JSON.stringify(this.activeFilters),
                bypassSharing: this.bypassSharing
            });

            if (result.success && result.records?.length) {
                this._exportToCSV(result.records);
            } else {
                this._showToast('Warning', 'No records to export', 'warning');
            }
        } catch (error) {
            this._showToast('Error', 'Failed to fetch all records for export', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    _exportToCSV(recordsToExport) {
        if (!recordsToExport?.length) {
            this._showToast('Warning', 'No records to export', 'warning');
            return;
        }

        try {
            const headers = this.columns.map(col => `"${col.label}"`).join(',');
            const rows = recordsToExport.map(record =>
                this.columns.map(col => {
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