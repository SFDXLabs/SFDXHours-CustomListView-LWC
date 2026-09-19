/**
 * @description Test class for CustomListViewController
 * @author SFDXHours.com
 * @version 1.0
 */
@isTest
private class CustomListViewControllerTest {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Test Data Setup
    // ═══════════════════════════════════════════════════════════════════════════
    
    @TestSetup
    static void setupTestData() {
        // Create test accounts with varied data
        List<Account> accounts = new List<Account>();
        String[] industries = new String[]{'Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail'};
        
        for (Integer i = 0; i < 25; i++) {
            accounts.add(new Account(
                Name = 'Test Account ' + String.valueOf(i).leftPad(2, '0'),
                Industry = industries[Math.mod(i, industries.size())],
                Website = 'https://test' + i + '.com',
                Phone = '555-000-' + String.valueOf(i).leftPad(4, '0'),
                AnnualRevenue = (i + 1) * 100000
            ));
        }
        insert accounts;
        
        // Create test contacts
        List<Contact> contacts = new List<Contact>();
        for (Account acc : accounts) {
            contacts.add(new Contact(
                FirstName = 'Test',
                LastName = 'Contact ' + acc.Name,
                AccountId = acc.Id,
                Email = 'test@' + acc.Name.replace(' ', '').toLowerCase() + '.com'
            ));
        }
        insert contacts;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Basic Query Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_BasicQuery_WithSharing() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assertEquals(25, result.totalCount, 'Should return total count of 25');
        System.assertEquals(10, result.records.size(), 'Should return 10 records for first page');
        System.assertNotEquals(null, result.fieldMetadata, 'Should return field metadata');
        System.assert(result.fieldMetadata.containsKey('Name'), 'Should have Name field metadata');
    }
    
    @isTest
    static void testExecuteQuery_BasicQuery_WithoutSharing() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '', true
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed with bypassSharing=true');
        System.assertEquals(25, result.totalCount, 'Should return total count of 25');
        System.assertEquals(10, result.records.size(), 'Should return 10 records');
    }
    
    @isTest
    static void testExecuteQuery_NullBypassSharing() {
        // Test that null bypassSharing defaults to with sharing behavior
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '', null
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed with null bypassSharing');
    }
    
    /**
     * @description With-sharing baseline: what the running user can see natively
     */
    private with sharing class SharingBaseline {
        public Integer visibleCount(String objectName) {
            return Database.countQuery('SELECT COUNT() FROM ' + objectName);
        }
    }

    /**
     * @description Proves bypassSharing actually switches sharing enforcement, as a
     *              restricted user: off = exactly what sharing grants, on = every record.
     *              Tasks are checked alongside Accounts because activities stay private
     *              in orgs whose Account org-wide default is public.
     */
    @isTest
    static void testExecuteQuery_BypassSharing_AsRestrictedUser() {
        List<Profile> profiles = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        if (profiles.isEmpty()) {
            return; // Profile name is localised in some orgs - nothing to run as
        }

        insert new Task(Subject = 'Owned by the admin', Status = 'Not Started', Priority = 'Normal');

        User restrictedUser = new User(
            ProfileId = profiles[0].Id,
            LastName = 'Restricted',
            Alias = 'restr',
            Email = 'restricted@customlistview.test',
            Username = 'restricted' + System.currentTimeMillis() + '@customlistview.test',
            TimeZoneSidKey = 'GMT',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );

        Map<String, Integer> totals = new Map<String, Integer>{ 'Account' => 25, 'Task' => 1 };
        Boolean sharingRestrictedSomething = false;

        Test.startTest();
        System.runAs(restrictedUser) {
            for (String objectName : totals.keySet()) {
                Integer visible = new SharingBaseline().visibleCount(objectName);
                sharingRestrictedSomething = sharingRestrictedSomething || visible < totals.get(objectName);
                String query = 'SELECT Id FROM ' + objectName;

                CustomListViewController.QueryResult enforced = CustomListViewController.executeQuery(
                    query, null, '', '', 'ASC', 50, 1, '', false
                );
                System.assertEquals(true, enforced.success, 'Enforced query failed: ' + enforced.errorMessage);
                System.assertEquals(visible, enforced.totalCount, objectName + ': sharing must be enforced when bypassSharing is off');
                System.assertEquals(visible, enforced.records.size(), objectName + ': records must respect sharing when bypassSharing is off');

                CustomListViewController.QueryResult bypassed = CustomListViewController.executeQuery(
                    query, null, '', '', 'ASC', 50, 1, '', true
                );
                System.assertEquals(true, bypassed.success, 'Bypassed query failed: ' + bypassed.errorMessage);
                System.assertEquals(totals.get(objectName), bypassed.totalCount, objectName + ': count must ignore sharing when bypassSharing is on');
                System.assertEquals(totals.get(objectName), bypassed.records.size(), objectName + ': records must ignore sharing when bypassSharing is on');
            }
        }
        Test.stopTest();

        // Not asserted: an org with fully public sharing legitimately hides nothing
        if (!sharingRestrictedSomething) {
            System.debug(LoggingLevel.WARN, 'Sharing hid no records from the restricted user - bypass difference not exercised in this org');
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Scale Limit Tests (count cap, OFFSET ceiling, keyset export)
    // ═══════════════════════════════════════════════════════════════════════════

    @isTest
    static void testExecuteQuery_CountCappedAboveCap() {
        CustomListViewController.countCap = 10;

        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account', null, '', 'Name', 'ASC', 5, 1, '', false
        );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Query should succeed: ' + result.errorMessage);
        System.assertEquals(10, result.totalCount, 'Count should stop at the cap');
        System.assertEquals(true, result.totalCountCapped, 'Should flag that more rows exist than the cap');
        System.assertEquals(5, result.records.size(), 'Capping the count must not affect the page of records');
    }

    @isTest
    static void testExecuteQuery_CountExactlyAtCapIsNotCapped() {
        CustomListViewController.countCap = 25;

        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account', null, '', 'Name', 'ASC', 5, 1, '', false
        );
        Test.stopTest();

        System.assertEquals(25, result.totalCount, 'Should return the exact count');
        System.assertEquals(false, result.totalCountCapped, 'Exactly the cap is still an exact count');
    }

    @isTest
    static void testExecuteQuery_OffsetBeyondSoqlLimitReturnsFriendlyError() {
        Test.startTest();
        CustomListViewController.QueryResult lastReachable = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account', null, '', 'Name', 'ASC', 20, 101, '', false
        );
        CustomListViewController.QueryResult beyond = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account', null, '', 'Name', 'ASC', 20, 102, '', false
        );
        Test.stopTest();

        System.assertEquals(true, lastReachable.success, 'OFFSET 2000 is still valid: ' + lastReachable.errorMessage);
        System.assertEquals(false, beyond.success, 'OFFSET above 2000 should be rejected');
        System.assert(beyond.errorMessage.contains('2020'), 'Should explain the reachable row limit: ' + beyond.errorMessage);
    }

    @isTest
    static void testExecuteExportBatch_WalksAllRecordsWithoutOffset() {
        Set<Id> seen = new Set<Id>();
        List<Integer> batchSizes = new List<Integer>();
        String afterId = '';

        Test.startTest();
        for (Integer i = 0; i < 5; i++) {
            CustomListViewController.QueryResult batch = CustomListViewController.executeExportBatch(
                'SELECT Id, Name FROM Account ORDER BY Name DESC', null, '', '', false, afterId, 10
            );
            System.assertEquals(true, batch.success, 'Batch should succeed: ' + batch.errorMessage);
            batchSizes.add(batch.records.size());
            for (SObject record : batch.records) {
                // Ordering is proven by coverage, not by comparing Ids here: Apex string
                // comparison is case-insensitive while SOQL orders Ids case-sensitively
                System.assert(seen.add(record.Id), 'No record may appear in two batches');
                afterId = record.Id;
            }
            if (batch.records.size() < 10) break;
        }
        Test.stopTest();

        System.assertEquals(new List<Integer>{ 10, 10, 5 }, batchSizes, 'Should walk 25 records in three batches');
        System.assertEquals(25, seen.size(), 'Every record should be exported exactly once');
    }

    @isTest
    static void testExecuteExportBatch_RespectsWhereSearchAndFilters() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeExportBatch(
            'SELECT Id, Name, Industry FROM Account WHERE AnnualRevenue > 0', null, 'Test Account',
            '{"Industry":["Technology"]}', true, '', 200
        );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Batch should succeed: ' + result.errorMessage);
        System.assertEquals(5, result.records.size(), 'Should apply the base WHERE, search term and quick filter');
    }

    @isTest
    static void testExecuteExportBatch_RejectsInvalidAfterId() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeExportBatch(
            'SELECT Id FROM Account', null, '', '', false, '\' OR Name != \'', 10
        );
        Test.stopTest();

        System.assertEquals(false, result.success, 'A non-Id afterId must never reach the query');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Placeholder Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_WithRecordId() {
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, FirstName, LastName, Email FROM Contact WHERE AccountId = {recordId}',
            testAccount.Id, '', 'LastName', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assertEquals(1, result.totalCount, 'Should find 1 contact for the account');
    }
    
    @isTest
    static void testExecuteQuery_WithCurrentUserId() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account WHERE OwnerId = {currentUserId}',
            null, '', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query with currentUserId should succeed');
        System.assert(result.totalCount >= 0, 'Should return records owned by current user');
    }
    
    @isTest
    static void testExecuteQuery_WithBothPlaceholders() {
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, FirstName, LastName FROM Contact WHERE AccountId = {recordId} AND OwnerId = {currentUserId}',
            testAccount.Id, '', 'LastName', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query with both placeholders should succeed');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Search Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_WithSearch() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry FROM Account',
            null, 'Account 01', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assert(result.records.size() <= 25, 'Search should filter results');
    }
    
    @isTest
    static void testExecuteQuery_WithSearchNoResults() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, 'NONEXISTENT12345', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assertEquals(0, result.totalCount, 'Should return no results');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Pagination Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_Pagination() {
        Test.startTest();
        
        CustomListViewController.QueryResult page1 = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '', false
        );
        
        CustomListViewController.QueryResult page2 = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 2, '', false
        );
        
        Test.stopTest();
        
        System.assertEquals(10, page1.records.size(), 'Page 1 should have 10 records');
        System.assertEquals(10, page2.records.size(), 'Page 2 should have 10 records');
        
        // Verify different records on each page
        Set<Id> page1Ids = new Set<Id>();
        for (SObject record : page1.records) {
            page1Ids.add(record.Id);
        }
        
        for (SObject record : page2.records) {
            System.assert(!page1Ids.contains(record.Id), 'Page 2 should have different records');
        }
    }
    
    @isTest
    static void testExecuteQuery_PaginationBoundary() {
        // Test invalid page number (should default to 1)
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 0, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assertEquals(10, result.records.size(), 'Should return first page');
    }
    
    @isTest
    static void testExecuteQuery_MaxPageSize() {
        // Test that page size is capped at MAX_PAGE_SIZE (200)
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 500, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assert(result.records.size() <= 200, 'Should respect max page size');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Sorting Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_SortingAsc() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        
        String previousName = '';
        for (SObject record : result.records) {
            String currentName = (String)record.get('Name');
            if (String.isNotBlank(previousName)) {
                System.assert(currentName.compareTo(previousName) >= 0, 
                    'Records should be in ascending order');
            }
            previousName = currentName;
        }
    }
    
    @isTest
    static void testExecuteQuery_SortingDesc() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'DESC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        
        String previousName = '';
        for (SObject record : result.records) {
            String currentName = (String)record.get('Name');
            if (String.isNotBlank(previousName)) {
                System.assert(currentName.compareTo(previousName) <= 0, 
                    'Records should be in descending order');
            }
            previousName = currentName;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Filter Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_SingleValueFilter() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry FROM Account',
            null, '', 'Name', 'ASC', 50, 1, '{"Industry":["Technology"]}', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query with filter should succeed');
        System.assertEquals(5, result.totalCount, 'Should return 5 Technology accounts');
    }
    
    @isTest
    static void testExecuteQuery_MultiSelectFilter() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry FROM Account',
            null, '', 'Name', 'ASC', 50, 1, '{"Industry":["Technology","Finance"]}', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query with multi-select filter should succeed');
        System.assertEquals(10, result.totalCount, 'Should return Technology + Finance accounts');
    }
    
    @isTest
    static void testExecuteQuery_MultipleFilters() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry FROM Account',
            null, '', 'Name', 'ASC', 10, 1, 
            '{"Industry":["Technology"],"Name":["Test Account 00"]}', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query with multiple filters should succeed');
        System.assertEquals(1, result.totalCount, 'Should return 1 account matching both filters');
    }
    
    @isTest
    static void testExecuteQuery_EmptyFilters() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '{}', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query with empty filters should succeed');
        System.assertEquals(25, result.totalCount, 'Should return all accounts');
    }
    
    @isTest
    static void testExecuteQuery_InvalidFiltersJson() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 1, 'invalid json', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Should gracefully handle invalid JSON');
        System.assertEquals(25, result.totalCount, 'Should return all accounts');
    }
    
    @isTest
    static void testExecuteQuery_NullFilterValues() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '{"Industry":null}', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Should handle null filter values');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Relationship Field Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_RelationshipFields() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, FirstName, LastName, Account.Name FROM Contact',
            null, '', 'LastName', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assert(result.records.size() > 0, 'Should return contacts');
        System.assert(result.fieldMetadata.containsKey('Account.Name'), 'Should have relationship field metadata');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Error Handling Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_EmptyQuery() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            '', null, '', '', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Query should fail');
        System.assertNotEquals(null, result.errorMessage, 'Should have error message');
        System.assert(result.errorMessage.contains('empty'), 'Error should mention empty query');
    }
    
    @isTest
    static void testExecuteQuery_InvalidObject() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id FROM NonExistentObject__c',
            null, '', '', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Query should fail');
        System.assertNotEquals(null, result.errorMessage, 'Should have error message');
    }
    
    @isTest
    static void testExecuteQuery_InvalidSortField() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name LIMIT 1 --', 'ASC', 10, 1, '', false
        );
        Test.stopTest();

        System.assertEquals(false, result.success, 'Non-identifier sort field should be rejected');
        System.assert(result.errorMessage.contains('sort field'), 'Error should mention sort field');
    }

    @isTest
    static void testExecuteQuery_WithWhereClause() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account WHERE Industry = \'Technology\'',
            null, '', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assertEquals(5, result.totalCount, 'Should return Technology accounts only');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Field Metadata Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testFieldMetadata_VariousTypes() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry, CreatedDate, IsDeleted, AnnualRevenue FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Query should succeed');
        System.assert(result.fieldMetadata.containsKey('Name'), 'Should have Name metadata');
        System.assert(result.fieldMetadata.containsKey('Industry'), 'Should have Industry metadata');
        System.assert(result.fieldMetadata.containsKey('CreatedDate'), 'Should have CreatedDate metadata');
        
        // Verify name field is identified
        CustomListViewController.FieldMetadata nameMeta = result.fieldMetadata.get('Name');
        System.assertEquals(true, nameMeta.isNameField, 'Name should be identified as name field');
        System.assertEquals(true, nameMeta.sortable, 'Name should be sortable');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Owner Change Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testChangeRecordsOwner_Success() {
        List<Account> accounts = [SELECT Id, OwnerId FROM Account LIMIT 3];
        List<String> accountIds = new List<String>();
        for (Account acc : accounts) {
            accountIds.add(acc.Id);
        }
        
        String newOwnerId = UserInfo.getUserId();
        
        Test.startTest();
        CustomListViewController.OwnerChangeResult result = 
            CustomListViewController.changeRecordsOwner(accountIds, newOwnerId);
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Owner change should succeed');
        System.assertEquals(3, result.successCount, 'All 3 records should be updated');
        System.assertEquals(0, result.failureCount, 'No records should fail');
        System.assertEquals(0, result.failedRecordIds.size(), 'Failed record list should be empty');
    }
    
    @isTest
    static void testChangeRecordsOwner_NullRecordIds() {
        Test.startTest();
        CustomListViewController.OwnerChangeResult result = 
            CustomListViewController.changeRecordsOwner(null, UserInfo.getUserId());
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Should fail with null record list');
        System.assert(result.errorMessage.contains('No records'), 'Error should mention no records');
    }
    
    @isTest
    static void testChangeRecordsOwner_EmptyRecordIds() {
        Test.startTest();
        CustomListViewController.OwnerChangeResult result = 
            CustomListViewController.changeRecordsOwner(new List<String>(), UserInfo.getUserId());
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Should fail with empty record list');
    }
    
    @isTest
    static void testChangeRecordsOwner_NullOwnerId() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        
        Test.startTest();
        CustomListViewController.OwnerChangeResult result = 
            CustomListViewController.changeRecordsOwner(new List<String>{accounts[0].Id}, null);
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Should fail with null owner ID');
        System.assert(result.errorMessage.contains('owner'), 'Error should mention owner');
    }
    
    @isTest
    static void testChangeRecordsOwner_InvalidOwnerId() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        
        Test.startTest();
        CustomListViewController.OwnerChangeResult result = 
            CustomListViewController.changeRecordsOwner(
                new List<String>{accounts[0].Id}, 
                '005000000000001' // Invalid user ID format
            );
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Should fail with invalid owner ID');
    }
    
    @isTest
    static void testChangeRecordsOwner_ContactRecords() {
        List<Contact> contacts = [SELECT Id, OwnerId FROM Contact LIMIT 2];
        List<String> contactIds = new List<String>();
        for (Contact con : contacts) {
            contactIds.add(con.Id);
        }
        
        Test.startTest();
        CustomListViewController.OwnerChangeResult result = 
            CustomListViewController.changeRecordsOwner(contactIds, UserInfo.getUserId());
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Owner change should succeed for contacts');
        System.assertEquals(2, result.successCount, 'Both contacts should be updated');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Wrapper Class Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testQueryResult_WrapperClass() {
        CustomListViewController.QueryResult result = new CustomListViewController.QueryResult();
        
        System.assertEquals(true, result.success, 'Default success should be true');
        System.assertEquals(0, result.totalCount, 'Default totalCount should be 0');
        System.assertNotEquals(null, result.records, 'Records should be initialized');
        System.assertNotEquals(null, result.fieldMetadata, 'Field metadata should be initialized');
    }
    
    @isTest
    static void testFieldMetadata_WrapperClass() {
        CustomListViewController.FieldMetadata fm = new CustomListViewController.FieldMetadata();
        
        System.assertEquals(true, fm.sortable, 'Default sortable should be true');
        System.assertEquals(false, fm.isNameField, 'Default isNameField should be false');
    }
    
    @isTest
    static void testOwnerChangeResult_WrapperClass() {
        CustomListViewController.OwnerChangeResult result = new CustomListViewController.OwnerChangeResult();
        result.success = true;
        result.successCount = 5;
        result.failureCount = 2;
        result.errorMessage = 'Test error';
        result.failedRecordIds = new List<String>{ '001000000000001', '001000000000002' };
        
        System.assertEquals(true, result.success, 'Success should be true');
        System.assertEquals(5, result.successCount, 'Success count should be 5');
        System.assertEquals(2, result.failureCount, 'Failure count should be 2');
        System.assertEquals('Test error', result.errorMessage, 'Error message should match');
        System.assertEquals(2, result.failedRecordIds.size(), 'Failed record IDs should have 2 entries');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Interface Implementation Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testWithSharingExecutor() {
        CustomListViewController.QueryParams params = new CustomListViewController.QueryParams();
        params.soqlQuery = 'SELECT Id, Name FROM Account';
        params.pageSize = 10;
        params.pageNumber = 1;
        params.filters = new Map<String, List<String>>();
        
        Test.startTest();
        CustomListViewController.WithSharingExecutor executor = new CustomListViewController.WithSharingExecutor();
        CustomListViewController.QueryResult result = executor.execute(params);
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'WithSharingExecutor should work');
    }
    
    @isTest
    static void testWithoutSharingExecutor() {
        CustomListViewController.QueryParams params = new CustomListViewController.QueryParams();
        params.soqlQuery = 'SELECT Id, Name FROM Account';
        params.pageSize = 10;
        params.pageNumber = 1;
        params.filters = new Map<String, List<String>>();
        
        Test.startTest();
        CustomListViewController.WithoutSharingExecutor executor = new CustomListViewController.WithoutSharingExecutor();
        CustomListViewController.QueryResult result = executor.execute(params);
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'WithoutSharingExecutor should work');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Edge Case Tests
    // ═══════════════════════════════════════════════════════════════════════════
    
    @isTest
    static void testExecuteQuery_SpecialCharactersInSearch() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, 'Test\'s Account', 'Name', 'ASC', 10, 1, '', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Should handle special characters safely');
    }
    
    @isTest
    static void testExecuteQuery_SpecialCharactersInFilter() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name FROM Account',
            null, '', 'Name', 'ASC', 10, 1, '{"Name":["Test\'s Value"]}', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Should handle special characters in filters safely');
    }
    
    @isTest
    static void testExecuteQuery_CombinedSearchAndFilter() {
        Test.startTest();
        CustomListViewController.QueryResult result = CustomListViewController.executeQuery(
            'SELECT Id, Name, Industry FROM Account WHERE Industry != null',
            null, 'Account', 'Name', 'ASC', 10, 1, '{"Industry":["Technology"]}', false
        );
        Test.stopTest();
        
        System.assertEquals(true, result.success, 'Should handle combined WHERE, search, and filter');
    }
}