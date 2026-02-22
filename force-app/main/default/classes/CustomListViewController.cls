/**
 * @description Controller for the Custom List View LWC component.
 *              Handles dynamic SOQL queries with field metadata retrieval.
 *              Supports both 'with sharing' and 'without sharing' modes via bypassSharing parameter.
 * @author SFDXHours.com
 * @version 1.0
 */
public inherited sharing class CustomListViewController {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Constants & Cache
    // ═══════════════════════════════════════════════════════════════════════════

    private static Map<String, Schema.SObjectType> globalDescribeCache;

    private static final Integer MAX_PAGE_SIZE = 200;
    private static final Integer MAX_SEARCH_RESULTS = 20;
    private static final Integer MIN_SEARCH_LENGTH = 2;
    private static final Set<String> UNSORTABLE_TYPES = new Set<String>{'TEXTAREA', 'MULTIPICKLIST', 'LOCATION'};
    private static final Set<Schema.DisplayType> SEARCHABLE_TYPES = new Set<Schema.DisplayType>{
        Schema.DisplayType.STRING,
        Schema.DisplayType.TEXTAREA,
        Schema.DisplayType.EMAIL,
        Schema.DisplayType.PHONE,
        Schema.DisplayType.URL,
        Schema.DisplayType.PICKLIST
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Wrapper Classes
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @description Wrapper class for returning query results with metadata
     */
    public class QueryResult {
        @AuraEnabled public List<SObject> records { get; set; }
        @AuraEnabled public Integer totalCount { get; set; }
        @AuraEnabled public Map<String, FieldMetadata> fieldMetadata { get; set; }
        @AuraEnabled public String errorMessage { get; set; }
        @AuraEnabled public Boolean success { get; set; }
        
        public QueryResult() {
            this.records = new List<SObject>();
            this.totalCount = 0;
            this.fieldMetadata = new Map<String, FieldMetadata>();
            this.success = true;
        }
    }
    
    /**
     * @description Wrapper class for field metadata information
     */
    public class FieldMetadata {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public Boolean sortable { get; set; }
        @AuraEnabled public String relationshipName { get; set; }
        @AuraEnabled public Boolean isNameField { get; set; }
        
        public FieldMetadata() {
            this.sortable = true;
            this.isNameField = false;
        }
    }
    
    /**
     * @description Wrapper class for owner change operation results
     */
    public class OwnerChangeResult {
        @AuraEnabled public Boolean success { get; set; }
        @AuraEnabled public Integer successCount { get; set; }
        @AuraEnabled public Integer failureCount { get; set; }
        @AuraEnabled public String errorMessage { get; set; }
        @AuraEnabled public List<String> failedRecordIds { get; set; }
        
        public OwnerChangeResult() {
            this.success = true;
            this.successCount = 0;
            this.failureCount = 0;
            this.failedRecordIds = new List<String>();
        }
    }
    
    /**
     * @description Internal wrapper for query parameters
     */
    public class QueryParams {
        public String soqlQuery;
        public String recordId;
        public String searchTerm;
        public String sortField;
        public String sortDirection;
        public Integer pageSize;
        public Integer pageNumber;
        public Map<String, List<String>> filters;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Query Executor Classes (Sharing Control)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @description Interface for query execution
     */
    public interface IQueryExecutor {
        QueryResult execute(QueryParams params);
    }
    
    /**
     * @description Query executor with sharing enforcement
     */
    public with sharing class WithSharingExecutor implements IQueryExecutor {
        public QueryResult execute(QueryParams params) {
            return CustomListViewController.executeQueryInternal(params);
        }
    }
    
    /**
     * @description Query executor without sharing enforcement
     */
    public without sharing class WithoutSharingExecutor implements IQueryExecutor {
        public QueryResult execute(QueryParams params) {
            return CustomListViewController.executeQueryInternal(params);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Public AuraEnabled Methods
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @description Executes the SOQL query and returns results with metadata.
     *              Supports both with/without sharing modes based on bypassSharing parameter.
     * @param soqlQuery The base SOQL query string
     * @param recordId Optional record ID to inject into query
     * @param searchTerm Optional search term for filtering
     * @param sortField Field to sort by
     * @param sortDirection ASC or DESC
     * @param pageSize Number of records per page
     * @param pageNumber Current page number (1-based)
     * @param filtersJson JSON string of field filters
     * @param bypassSharing If true, executes query without sharing rules
     * @return QueryResult containing records, count, and metadata
     */
    @AuraEnabled(cacheable=false)
    public static QueryResult executeQuery(
        String soqlQuery,
        String recordId,
        String searchTerm,
        String sortField,
        String sortDirection,
        Integer pageSize,
        Integer pageNumber,
        String filtersJson,
        Boolean bypassSharing
    ) {
        QueryResult result = new QueryResult();
        
        try {
            // Build query parameters
            QueryParams params = new QueryParams();
            params.soqlQuery = soqlQuery;
            params.recordId = recordId;
            params.searchTerm = searchTerm;
            params.sortField = sortField;
            params.sortDirection = sortDirection;
            params.pageSize = Math.min(pageSize != null ? pageSize : 20, MAX_PAGE_SIZE);
            params.pageNumber = pageNumber != null && pageNumber > 0 ? pageNumber : 1;
            params.filters = parseFilters(filtersJson);
            
            // Select appropriate executor based on sharing setting
            IQueryExecutor executor = (bypassSharing == true) 
                ? (IQueryExecutor) new WithoutSharingExecutor() 
                : (IQueryExecutor) new WithSharingExecutor();
            
            result = executor.execute(params);
            
        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
        }
        
        return result;
    }
    
    /**
     * @description Searches for active users by name or email
     * @param searchTerm The search term to filter users
     * @return List of matching User records
     */
    @AuraEnabled(cacheable=true)
    public static List<User> searchUsers(String searchTerm) {
        if (String.isBlank(searchTerm) || searchTerm.length() < MIN_SEARCH_LENGTH) {
            return new List<User>();
        }
        
        String searchPattern = '%' + String.escapeSingleQuotes(searchTerm.trim()) + '%';
        
        return [
            SELECT Id, Name, Email, SmallPhotoUrl, Title
            FROM User
            WHERE IsActive = true
                AND (Name LIKE :searchPattern OR Email LIKE :searchPattern)
            ORDER BY Name ASC
            LIMIT :MAX_SEARCH_RESULTS
        ];
    }
    
    /**
     * @description Changes the owner of multiple records
     * @param recordIds List of record IDs to update
     * @param newOwnerId The ID of the new owner
     * @return OwnerChangeResult with success/failure information
     */
    @AuraEnabled
    public static OwnerChangeResult changeRecordsOwner(List<String> recordIds, String newOwnerId) {
        OwnerChangeResult result = new OwnerChangeResult();
        
        try {
            // Validate inputs
            validateOwnerChangeInputs(recordIds, newOwnerId);
            
            // Validate the new owner
            validateNewOwner(newOwnerId);
            
            // Get object type and validate it supports owner changes
            Id firstRecordId = Id.valueOf(recordIds[0]);
            Schema.SObjectType sObjectType = firstRecordId.getSObjectType();
            validateOwnerSupport(sObjectType);
            
            // Build records for update
            List<SObject> recordsToUpdate = buildOwnerUpdateRecords(recordIds, newOwnerId, sObjectType);
            
            // Execute update with partial success
            processOwnerChangeResults(Database.update(recordsToUpdate, false), recordIds, result);
            
        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
        }
        
        return result;
    }
    
    /**
     * @description Gets the record URL for navigation (kept for backward compatibility)
     * @param recordId The record ID
     * @return The relative URL to the record
     */
    @AuraEnabled(cacheable=true)
    public static String getRecordUrl(String recordId) {
        return '/' + String.escapeSingleQuotes(recordId);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Schema Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @description Returns cached global describe to avoid repeated expensive calls within a transaction
     */
    private static Map<String, Schema.SObjectType> getCachedGlobalDescribe() {
        if (globalDescribeCache == null) {
            globalDescribeCache = Schema.getGlobalDescribe();
        }
        return globalDescribeCache;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Query Execution
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @description Internal method that performs the actual query execution
     */
    public static QueryResult executeQueryInternal(QueryParams params) {
        QueryResult result = new QueryResult();
        
        // Validate query
        if (String.isBlank(params.soqlQuery)) {
            throw newAuraException('SOQL query cannot be empty');
        }
        
        // Process query with placeholders
        String processedQuery = processPlaceholders(params.soqlQuery, params.recordId);
        
        // Parse query components
        String objectName = extractObjectName(processedQuery);
        List<String> queryFields = extractFields(processedQuery);
        
        // Validate object exists
        Schema.SObjectType sObjectType = getCachedGlobalDescribe().get(objectName);
        if (sObjectType == null) {
            throw newAuraException('Invalid object: ' + objectName);
        }
        
        // Get field metadata
        result.fieldMetadata = getFieldMetadata(objectName, queryFields);
        
        // Build and execute queries
        String whereClause = buildWhereClause(processedQuery, params.searchTerm, queryFields, objectName, params.filters);
        
        // Execute count query
        String countQuery = 'SELECT COUNT() FROM ' + String.escapeSingleQuotes(objectName);
        if (String.isNotBlank(whereClause)) {
            countQuery += ' WHERE ' + whereClause;
        }
        result.totalCount = Database.countQuery(countQuery);
        
        // Execute data query
        String dataQuery = buildDataQuery(queryFields, objectName, whereClause, params);
        result.records = Database.query(dataQuery);
        
        return result;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Query Building Helpers
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @description Processes placeholder values in the query
     */
    private static String processPlaceholders(String query, String recordId) {
        String result = query;
        
        if (String.isNotBlank(recordId)) {
            result = result.replace('{recordId}', '\'' + String.escapeSingleQuotes(recordId) + '\'');
        }
        
        if (result.contains('{currentUserId}')) {
            result = result.replace('{currentUserId}', '\'' + UserInfo.getUserId() + '\'');
        }
        
        return result;
    }
    
    /**
     * @description Parses filters from JSON string
     */
    private static Map<String, List<String>> parseFilters(String filtersJson) {
        Map<String, List<String>> filters = new Map<String, List<String>>();
        
        if (String.isBlank(filtersJson)) {
            return filters;
        }
        
        try {
            Map<String, Object> parsedFilters = (Map<String, Object>) JSON.deserializeUntyped(filtersJson);
            
            for (String key : parsedFilters.keySet()) {
                Object val = parsedFilters.get(key);
                if (val == null) continue;
                
                List<String> values = new List<String>();
                
                if (val instanceof List<Object>) {
                    for (Object item : (List<Object>) val) {
                        if (item != null && String.isNotBlank(String.valueOf(item))) {
                            values.add(String.valueOf(item));
                        }
                    }
                } else if (String.isNotBlank(String.valueOf(val))) {
                    values.add(String.valueOf(val));
                }
                
                if (!values.isEmpty()) {
                    filters.put(key, values);
                }
            }
        } catch (Exception e) {
            // Log but don't fail - invalid JSON just means no filters
            System.debug(LoggingLevel.WARN, 'Error parsing filters JSON: ' + e.getMessage());
        }
        
        return filters;
    }
    
    /**
     * @description Extracts the object name from the SOQL query
     */
    private static String extractObjectName(String soqlQuery) {
        Pattern p = Pattern.compile('(?i)FROM\\s+(\\w+)');
        Matcher m = p.matcher(soqlQuery);
        
        if (m.find()) {
            return m.group(1);
        }
        
        throw newAuraException('Could not determine object name from query');
    }
    
    /**
     * @description Extracts field names from the SELECT clause
     */
    private static List<String> extractFields(String soqlQuery) {
        List<String> fields = new List<String>();
        Pattern p = Pattern.compile('(?i)SELECT\\s+(.+?)\\s+FROM');
        Matcher m = p.matcher(soqlQuery);
        
        if (m.find()) {
            for (String field : m.group(1).split(',')) {
                String trimmedField = field.trim();
                if (String.isNotBlank(trimmedField)) {
                    fields.add(trimmedField);
                }
            }
        }
        
        return fields;
    }
    
    /**
     * @description Builds the complete WHERE clause including search and filters
     */
    private static String buildWhereClause(
        String originalQuery, 
        String searchTerm, 
        List<String> fields, 
        String objectName, 
        Map<String, List<String>> filters
    ) {
        // Extract existing WHERE clause
        String whereClause = '';
        Pattern p = Pattern.compile('(?i)WHERE\\s+(.+?)(?:\\s+ORDER|\\s+LIMIT|\\s+OFFSET|$)');
        Matcher m = p.matcher(originalQuery);
        
        if (m.find()) {
            whereClause = m.group(1).trim();
        }
        
        // Add search filter
        if (String.isNotBlank(searchTerm)) {
            String searchFilter = buildSearchFilter(fields, searchTerm, objectName);
            if (String.isNotBlank(searchFilter)) {
                whereClause = combineConditions(whereClause, searchFilter);
            }
        }
        
        // Add quick filters
        if (filters != null && !filters.isEmpty()) {
            String filterConditions = buildFilterConditions(filters);
            if (String.isNotBlank(filterConditions)) {
                whereClause = combineConditions(whereClause, filterConditions);
            }
        }
        
        return whereClause;
    }
    
    /**
     * @description Combines two WHERE conditions with AND
     */
    private static String combineConditions(String existing, String additional) {
        if (String.isBlank(existing)) {
            return additional;
        }
        return '(' + existing + ') AND (' + additional + ')';
    }
    
    /**
     * @description Builds the data query with sorting and pagination
     */
    private static String buildDataQuery(
        List<String> fields, 
        String objectName, 
        String whereClause, 
        QueryParams params
    ) {
        // Ensure Id is included
        Set<String> fieldSet = new Set<String>();
        for (String field : fields) {
            fieldSet.add(field.toLowerCase());
        }
        
        String selectClause = fieldSet.contains('id') 
            ? 'SELECT ' + String.join(fields, ', ')
            : 'SELECT Id, ' + String.join(fields, ', ');
        
        String query = selectClause + ' FROM ' + String.escapeSingleQuotes(objectName);
        
        if (String.isNotBlank(whereClause)) {
            query += ' WHERE ' + whereClause;
        }
        
        // Add ORDER BY
        if (String.isNotBlank(params.sortField)) {
            String direction = (params.sortDirection == 'DESC') ? 'DESC NULLS LAST' : 'ASC NULLS FIRST';
            query += ' ORDER BY ' + String.escapeSingleQuotes(params.sortField) + ' ' + direction;
        }
        
        // Add LIMIT and OFFSET
        Integer offset = (params.pageNumber - 1) * params.pageSize;
        query += ' LIMIT ' + params.pageSize + ' OFFSET ' + offset;
        
        return query;
    }
    
    /**
     * @description Builds filter conditions supporting multi-select values
     */
    private static String buildFilterConditions(Map<String, List<String>> filters) {
        List<String> conditions = new List<String>();
        
        for (String fieldName : filters.keySet()) {
            List<String> values = filters.get(fieldName);
            
            if (values == null || values.isEmpty()) continue;
            
            // Escape field name for safety
            String safeFieldName = String.escapeSingleQuotes(fieldName);
            
            if (values.size() == 1) {
                conditions.add(safeFieldName + ' = \'' + String.escapeSingleQuotes(values[0]) + '\'');
            } else {
                List<String> escapedValues = new List<String>();
                for (String val : values) {
                    escapedValues.add('\'' + String.escapeSingleQuotes(val) + '\'');
                }
                conditions.add(safeFieldName + ' IN (' + String.join(escapedValues, ', ') + ')');
            }
        }
        
        return conditions.isEmpty() ? '' : String.join(conditions, ' AND ');
    }
    
    /**
     * @description Builds a search filter for text fields
     */
    private static String buildSearchFilter(List<String> fields, String searchTerm, String objectName) {
        List<String> conditions = new List<String>();
        String escapedTerm = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        
        try {
            Schema.SObjectType sObjectType = getCachedGlobalDescribe().get(objectName);
            if (sObjectType == null) return '';
            
            Map<String, Schema.SObjectField> fieldMap = sObjectType.getDescribe().fields.getMap();
            
            for (String fieldName : fields) {
                // Skip relationship fields
                if (fieldName.contains('.')) continue;
                
                Schema.SObjectField field = fieldMap.get(fieldName.toLowerCase());
                if (field != null && SEARCHABLE_TYPES.contains(field.getDescribe().getType())) {
                    conditions.add(String.escapeSingleQuotes(fieldName) + ' LIKE \'' + escapedTerm + '\'');
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Error building search filter: ' + e.getMessage());
        }
        
        return conditions.isEmpty() ? '' : String.join(conditions, ' OR ');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Field Metadata Helpers
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @description Gets metadata for the specified fields
     */
    private static Map<String, FieldMetadata> getFieldMetadata(String objectName, List<String> fields) {
        Map<String, FieldMetadata> metadata = new Map<String, FieldMetadata>();
        
        Schema.SObjectType sObjectType = getCachedGlobalDescribe().get(objectName);
        if (sObjectType == null) return metadata;
        
        Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
        Map<String, Schema.SObjectField> fieldMap = describeResult.fields.getMap();
        
        for (String fieldName : fields) {
            FieldMetadata fm = new FieldMetadata();
            
            if (fieldName.contains('.')) {
                processRelationshipFieldMetadata(fm, fieldName, fieldMap);
            } else {
                processDirectFieldMetadata(fm, fieldName, fieldMap);
            }
            
            metadata.put(fieldName, fm);
        }
        
        return metadata;
    }
    
    /**
     * @description Processes metadata for relationship fields
     */
    private static void processRelationshipFieldMetadata(
        FieldMetadata fm, 
        String fieldName, 
        Map<String, Schema.SObjectField> fieldMap
    ) {
        List<String> parts = fieldName.split('\\.');
        String relationshipName = parts[0];
        String relatedFieldName = parts[1];
        
        // Determine lookup field name
        String lookupFieldName = relationshipName.endsWith('__r') 
            ? relationshipName.replace('__r', '__c') 
            : relationshipName + 'Id';
        
        Schema.SObjectField lookupField = fieldMap.get(lookupFieldName.toLowerCase());
        
        if (lookupField != null) {
            List<Schema.SObjectType> references = lookupField.getDescribe().getReferenceTo();
            
            if (!references.isEmpty()) {
                Map<String, Schema.SObjectField> relatedFieldMap = references[0].getDescribe().fields.getMap();
                Schema.SObjectField relatedField = relatedFieldMap.get(relatedFieldName.toLowerCase());
                
                if (relatedField != null) {
                    Schema.DescribeFieldResult relatedFieldDescribe = relatedField.getDescribe();
                    fm.label = relatedFieldDescribe.getLabel();
                    fm.type = String.valueOf(relatedFieldDescribe.getType());
                    fm.relationshipName = relationshipName;
                    fm.isNameField = relatedFieldDescribe.isNameField();
                    return;
                }
            }
        }
        
        // Fallback if we couldn't resolve the relationship
        fm.label = fieldName;
        fm.type = 'STRING';
    }
    
    /**
     * @description Processes metadata for direct (non-relationship) fields
     */
    private static void processDirectFieldMetadata(
        FieldMetadata fm, 
        String fieldName, 
        Map<String, Schema.SObjectField> fieldMap
    ) {
        Schema.SObjectField field = fieldMap.get(fieldName.toLowerCase());
        
        if (field != null) {
            Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
            fm.label = fieldDescribe.getLabel();
            fm.type = String.valueOf(fieldDescribe.getType());
            fm.isNameField = fieldDescribe.isNameField();
            fm.sortable = !UNSORTABLE_TYPES.contains(fm.type);
        } else {
            fm.label = fieldName;
            fm.type = 'STRING';
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Owner Change Helpers
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @description Validates inputs for owner change operation
     */
    private static void validateOwnerChangeInputs(List<String> recordIds, String newOwnerId) {
        if (recordIds == null || recordIds.isEmpty()) {
            throw newAuraException('No records selected for owner change');
        }
        
        if (String.isBlank(newOwnerId)) {
            throw newAuraException('New owner must be selected');
        }
    }
    
    /**
     * @description Validates that the new owner exists and is active
     */
    private static void validateNewOwner(String newOwnerId) {
        List<User> newOwnerList = [
            SELECT Id, Name, IsActive 
            FROM User 
            WHERE Id = :newOwnerId 
            LIMIT 1
        ];
        
        if (newOwnerList.isEmpty()) {
            throw newAuraException('Selected user not found');
        }
        
        if (!newOwnerList[0].IsActive) {
            throw newAuraException('Selected user is not active');
        }
    }
    
    /**
     * @description Validates that the object type supports owner changes
     */
    private static void validateOwnerSupport(Schema.SObjectType sObjectType) {
        Map<String, Schema.SObjectField> fieldMap = sObjectType.getDescribe().fields.getMap();
        
        if (!fieldMap.containsKey('ownerid')) {
            throw newAuraException('The selected object type does not support owner changes');
        }
    }
    
    /**
     * @description Builds SObject records for owner update
     */
    private static List<SObject> buildOwnerUpdateRecords(
        List<String> recordIds, 
        String newOwnerId, 
        Schema.SObjectType sObjectType
    ) {
        List<SObject> recordsToUpdate = new List<SObject>();
        
        for (String recordId : recordIds) {
            SObject record = sObjectType.newSObject(Id.valueOf(recordId));
            record.put('OwnerId', newOwnerId);
            recordsToUpdate.add(record);
        }
        
        return recordsToUpdate;
    }
    
    /**
     * @description Processes the results of the owner change operation
     */
    private static void processOwnerChangeResults(
        Database.SaveResult[] saveResults, 
        List<String> recordIds, 
        OwnerChangeResult result
    ) {
        for (Integer i = 0; i < saveResults.size(); i++) {
            if (saveResults[i].isSuccess()) {
                result.successCount++;
            } else {
                result.failureCount++;
                result.failedRecordIds.add(recordIds[i]);
                
                // Capture first error message
                if (String.isBlank(result.errorMessage)) {
                    for (Database.Error err : saveResults[i].getErrors()) {
                        result.errorMessage = err.getMessage();
                        break;
                    }
                }
            }
        }
        
        result.success = result.failureCount == 0;

        if (result.failureCount > 0 && result.successCount > 0) {
            result.errorMessage = 'Partially successful. ' + result.successCount + ' record(s) updated, ' +
                result.failureCount + ' record(s) failed. First error: ' + result.errorMessage;
        }
    }

    /**
     * @description Creates an AuraHandledException with a message accessible via getMessage().
     * The AuraHandledException constructor sets the client-facing message but getMessage()
     * returns 'Script-thrown exception' unless setMessage() is also called.
     */
    private static AuraHandledException newAuraException(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        return ex;
    }
}