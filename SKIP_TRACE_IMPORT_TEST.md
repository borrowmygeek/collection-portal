# Skip Trace Import Test

## Overview
This document outlines the testing process for the new Skip Trace import functionality.

## Test Data
The skip trace import uses the `skip_examples.csv` file as the template. This file contains comprehensive skip trace data including:

### Input Fields
- Account Key, SSN, Name, Address, City, State, Zip Code, Scrub Date

### Deceased Information
- Deceased status, IDI information, SSDI information, Obituary information

### Bankruptcy Information
- Bankruptcy status, case details, court information, attorney information

### Address Information
- Current addresses with first/last seen dates

### Phone Information
- Up to 3 phone numbers with types and dates

### Property Information
- Up to 3 properties with ownership, value, and loan information

### Relatives Information
- Up to 5 relatives with contact information and relationships

### Vehicle Information
- Vehicle details, registration, ownership, lien information

### Employment Information
- Employer details, job titles, contact information

## Test Steps

### 1. Basic Import Test
1. Navigate to the Import page
2. Select "Skip Trace" as the import type
3. Upload the `skip_examples.csv` file
4. Verify the import processes successfully
5. Check that all data is populated in the appropriate tables

### 2. Data Verification
After import, verify the following data is correctly populated:

#### Persons Table
- SSN: 600-12-9645, 301-64-3345, 439-72-2866
- Names: GOMEZ SULAY, JOHNSON SCOTT, WHITE JOAN
- Deceased status: N, N, N

#### Phone Numbers Table
- Person 1: 5203128944, 5205890867, 5206614674
- Person 2: 4199537480, 4199534780, 4199537481
- Person 3: 9852159651, 5044737375, 5042150604

#### Person Addresses Table
- Person 1: 2600 W INA RD APT 224, TUCSON, AZ, 85741
- Person 2: 4115 274TH ST, BRANFORD, FL, 32008
- Person 3: 933 BILL ST APT B, HAMMOND, LA, 70403

#### Relatives Table
- Person 1: JUAN KANE ROMERO (SPOUSE), ERNESTO R CORONADO (PARENT), etc.
- Person 2: CAROLYN M KOBACK (SPOUSE), CHERYL ANN JOHNSON (SPOUSE), etc.
- Person 3: BUFORD E WHITE SR (SPOUSE), SHELITA LANOVI WHITE (CHILD), etc.

#### Properties Table
- Person 3: 3205 PRESS ST NEW ORLEANS LA 70126 (Property 1)

#### Vehicles Table
- Person 1: NISSAN JUKE 2012 (VIN: JN8AF5MV7CT119547)
- Person 2: FORD RANGER 1996 (VIN: 1FTCR14U5TTA01721)
- Person 3: LINCOLN MKZ 2007 (VIN: 3LNHM26T97R664064)

#### Places of Employment Table
- Person 3: SOCIAL SECURITY (if employment data is present)

#### Bankruptcies Table
- Person 3: Case details if bankruptcy data is present

### 3. Error Handling Test
1. Upload a file with invalid SSN format
2. Verify appropriate error messages are displayed
3. Check that failed rows are properly tracked

### 4. Duplicate Handling Test
1. Import the same file twice
2. Verify that existing persons are found and updated
3. Verify that new skip trace data is added without duplicates

### 5. Field Mapping Test
1. Test with custom field mapping
2. Verify that the default field mapping works correctly
3. Test with partial field mapping

## Expected Results

### Successful Import
- All persons should be created or found by SSN
- All skip trace data should be populated in appropriate tables
- No duplicate records should be created
- Import job should show "completed" status

### Data Quality
- Phone numbers should be properly formatted
- Addresses should be complete and properly structured
- Relationships should be correctly categorized
- Dates should be properly parsed

### Performance
- Import should handle the 3-row test file efficiently
- Progress updates should be displayed during processing
- Error handling should be graceful

## Troubleshooting

### Common Issues
1. **SSN Format Issues**: Ensure SSNs are properly formatted (digits only)
2. **Date Parsing**: Check that dates are in expected format (MM/DD/YYYY)
3. **Phone Number Formatting**: Verify phone numbers are properly normalized
4. **Field Mapping**: Ensure CSV column names match expected format

### Debug Information
- Check import job logs for detailed error messages
- Verify database table schemas match expected structure
- Review field mapping configuration

## Notes
- Skip trace imports do not require portfolio assignment
- The import uses the default field mapping for the skip_examples.csv format
- All skip trace data is linked to persons via SSN
- Duplicate prevention is handled at the record level for each table 