'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { 
  DocumentDuplicateIcon, 
  DocumentArrowDownIcon,
  SparklesIcon,
  TrashIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

// Fuzzy matching field mappings - Focused on Debt Collection
const FIELD_MAPPINGS = {
  // Core Debt Information
  'account_number': ['account_number', 'account', 'acct', 'acnt', 'account_num', 'acct_num', 'acct_no', 'account_no', 'loan_number', 'loan_num', 'debt_number', 'debt_num', 'reference', 'ref', 'case_number', 'case_num', 'current_account', 'current_acct'],
  'original_account_number': ['original_account_number', 'original_account', 'orig_account', 'original_acct', 'orig_acct', 'original_account_num', 'orig_account_num', 'original_loan_number', 'original_loan_num', 'original_debt_number', 'original_debt_num', 'original_reference', 'original_ref', 'original_case_number', 'original_case_num'],
  'original_creditor': ['original_creditor', 'originalcreditor', 'originalcred', 'orig_creditor', 'origcreditor', 'creditor', 'original_cred', 'cred', 'creditor_name', 'original_lender', 'lender', 'bank', 'financial_institution', 'creditor_bank', 'original_bank', 'issuing_bank'],
  'original_balance': ['original_balance', 'orig_balance', 'original_bal', 'orig_bal', 'original_amount', 'orig_amount', 'principal_balance', 'principal', 'original_principal', 'loan_amount', 'debt_amount', 'original_debt'],
  'current_balance': ['current_balance', 'curr_balance', 'current_bal', 'curr_bal', 'balance', 'bal', 'amount', 'amt', 'outstanding_balance', 'outstanding_bal', 'remaining_balance', 'remaining_bal', 'current_amount', 'debt_balance'],
  'charge_off_date': ['charge_off_date', 'chargeoff_date', 'charge_off', 'chargeoff', 'co_date', 'charge_off_dt', 'chargeoff_dt', 'charged_off_date', 'charged_off', 'default_date', 'default_dt', 'write_off_date', 'write_off_dt'],
  'date_opened': ['date_opened', 'opened_date', 'open_date', 'account_opened', 'opened', 'open_dt', 'origination_date', 'origination_dt', 'start_date', 'begin_date', 'account_start_date'],
  'last_payment_date': ['last_payment_date', 'last_payment', 'last_payment_dt', 'last_pay_date', 'last_pay_dt', 'final_payment_date', 'final_payment', 'last_activity_date', 'last_activity'],
  'last_payment_amount': ['last_payment_amount', 'last_payment_amt', 'last_pay_amount', 'last_pay_amt', 'final_payment_amount', 'final_payment_amt'],

  // Account Classification
  'account_type': ['account_type', 'acct_type', 'type', 'account_category', 'acct_category', 'debt_type', 'loan_type', 'credit_type', 'account_classification'],
  'account_subtype': ['account_subtype', 'acct_subtype', 'subtype', 'sub_type', 'account_sub_category', 'debt_subtype', 'loan_subtype'],
  'account_status': ['account_status', 'acct_status', 'status', 'account_state', 'acct_state', 'debt_status', 'collection_status', 'account_condition'],

  // Collection Information
  'collection_status': ['collection_status', 'coll_status', 'collection_state', 'coll_state', 'collection_stage', 'collection_phase', 'debt_stage', 'collection_level'],
  'collection_priority': ['collection_priority', 'coll_priority', 'priority', 'collection_level', 'coll_level', 'debt_priority', 'priority_level', 'collection_score'],
  'assigned_collector_email': ['assigned_collector_email', 'collector_email', 'collector', 'assigned_to', 'collector_id', 'assigned_agent', 'agent_email', 'collector_agent'],

  // Debtor Identification
  'ssn': ['ssn', 'social_security', 'social_security_number', 'ss_number', 'social', 'tax_id', 'taxid', 'social_security_num', 'ssn_number'],
  'first_name': ['first_name', 'firstname', 'first', 'fname', 'given_name', 'givenname', 'debtor_first_name', 'borrower_first_name'],
  'middle_name': ['middle_name', 'middlename', 'middle', 'mname', 'middle_initial', 'mi', 'debtor_middle_name', 'borrower_middle_name'],
  'last_name': ['last_name', 'lastname', 'last', 'lname', 'surname', 'family_name', 'debtor_last_name', 'borrower_last_name'],
  'name_prefix': ['name_prefix', 'prefix', 'title', 'name_title', 'honorific', 'debtor_prefix', 'borrower_prefix'],
  'name_suffix': ['name_suffix', 'suffix', 'name_suffix_jr', 'jr', 'sr', 'iii', 'iv', 'debtor_suffix', 'borrower_suffix'],
  'dob': ['dob', 'date_of_birth', 'birth_date', 'birthdate', 'birth_dt', 'date_of_birth_dt', 'debtor_dob', 'borrower_dob', 'birthday'],

  // Contact Information - Primary
  'phone_primary': ['phone_primary', 'primary_phone', 'phone', 'phone_number', 'phone_num', 'tel', 'telephone', 'debtor_phone', 'borrower_phone', 'home_phone', 'cell_phone', 'mobile_phone'],
  'phone_secondary': ['phone_secondary', 'secondary_phone', 'phone2', 'phone_2', 'alt_phone', 'alternate_phone', 'debtor_phone2', 'borrower_phone2', 'work_phone', 'business_phone'],
  'phone_work': ['phone_work', 'work_phone', 'business_phone', 'office_phone', 'work_tel', 'employer_phone', 'job_phone'],
  'email_primary': ['email_primary', 'primary_email', 'email', 'email_address', 'email_addr', 'e_mail', 'debtor_email', 'borrower_email', 'personal_email'],
  'email_secondary': ['email_secondary', 'secondary_email', 'email2', 'email_2', 'alt_email', 'alternate_email', 'debtor_email2', 'borrower_email2', 'work_email', 'business_email'],

  // Address Information
  'address_line1': ['address_line1', 'address1', 'address_1', 'street_address', 'street', 'address_line_1', 'debtor_address', 'borrower_address', 'home_address', 'residence_address', 'mailing_address'],
  'address_line2': ['address_line2', 'address2', 'address_2', 'address_line_2', 'apt', 'apartment', 'unit', 'suite', 'debtor_address2', 'borrower_address2'],
  'city': ['city', 'city_name', 'town', 'town_name', 'municipality', 'debtor_city', 'borrower_city', 'residence_city'],
  'state': ['state', 'state_name', 'province', 'state_code', 'state_abbr', 'debtor_state', 'borrower_state', 'residence_state'],
  'zipcode': ['zipcode', 'zip', 'zip_code', 'postal_code', 'postcode', 'zip_code_5', 'debtor_zip', 'borrower_zip', 'residence_zip'],
  'county': ['county', 'county_name', 'parish', 'borough', 'debtor_county', 'borrower_county'],
  'country': ['country', 'country_name', 'nation', 'debtor_country', 'borrower_county'],

  // Employment Information
  'occupation': ['occupation', 'job', 'job_title', 'jobtitle', 'profession', 'work_title', 'debtor_occupation', 'borrower_occupation', 'employment_title'],
  'employer': ['employer', 'employer_name', 'company', 'company_name', 'work_company', 'employer_company', 'debtor_employer', 'borrower_employer', 'employer_company_name'],
  'annual_income': ['annual_income', 'income', 'yearly_income', 'salary', 'annual_salary', 'yearly_salary', 'debtor_income', 'borrower_income', 'monthly_income', 'monthly_salary'],

  // Compliance and Legal
  'do_not_call': ['do_not_call', 'do_not_call_flag', 'dnc', 'no_call', 'do_not_contact', 'debtor_dnc', 'borrower_dnc', 'dnc_flag'],
  'do_not_mail': ['do_not_mail', 'do_not_mail_flag', 'dnm', 'no_mail', 'do_not_send_mail', 'debtor_dnm', 'borrower_dnm', 'dnm_flag'],
  'do_not_email': ['do_not_email', 'do_not_email_flag', 'dne', 'no_email', 'do_not_send_email', 'debtor_dne', 'borrower_dne', 'dne_flag'],
  'do_not_text': ['do_not_text', 'do_not_text_flag', 'dnt', 'no_text', 'do_not_sms', 'debtor_dnt', 'borrower_dnt', 'dnt_flag'],
  'bankruptcy_filed': ['bankruptcy_filed', 'bankruptcy', 'bankruptcy_flag', 'bk_filed', 'bankruptcy_status', 'debtor_bankruptcy', 'borrower_bankruptcy', 'bk_flag'],
  'active_military': ['active_military', 'military', 'military_flag', 'active_duty', 'military_status', 'debtor_military', 'borrower_military', 'scra_flag'],
  'hardship_declared': ['hardship_declared', 'hardship', 'hardship_flag', 'hardship_status', 'debtor_hardship', 'borrower_hardship'],
  'hardship_type': ['hardship_type', 'hardship_category', 'hardship_reason', 'hardship_kind', 'debtor_hardship_type', 'borrower_hardship_type'],

  // Portfolio and Client Information
  'portfolio_name': ['portfolio_name', 'portfolio', 'portfolio_id', 'portfolio_code', 'port_name', 'collection_portfolio', 'debt_portfolio'],
  'client_name': ['client_name', 'client', 'client_id', 'client_code', 'creditor_name', 'original_creditor', 'debt_owner', 'debt_buyer', 'collection_agency'],

  // Additional Debt Information
  'interest_rate': ['interest_rate', 'rate', 'apr', 'annual_percentage_rate', 'interest', 'debt_interest_rate', 'loan_interest_rate'],
  'late_fees': ['late_fees', 'late_fee', 'late_charges', 'late_charge', 'penalty_fees', 'penalty_fee'],
  'collection_fees': ['collection_fees', 'collection_fee', 'collection_charges', 'collection_charge', 'recovery_fees', 'recovery_fee'],
  'debt_age': ['debt_age', 'age', 'days_past_due', 'days_delinquent', 'delinquency_days', 'charge_off_age', 'collection_age'],
  'last_activity_date': ['last_activity_date', 'last_activity', 'last_activity_dt', 'last_transaction_date', 'last_transaction', 'activity_date'],
  'next_payment_due': ['next_payment_due', 'next_payment_due_date', 'next_due_date', 'payment_due_date', 'due_date', 'next_payment'],
  'payment_plan': ['payment_plan', 'payment_agreement', 'settlement_plan', 'payment_arrangement', 'payment_schedule'],
  'settlement_amount': ['settlement_amount', 'settlement_amt', 'settlement_offer', 'settlement_balance', 'settlement_total'],

  // Bank Information (for payday loans, etc.)
  'original_bank_name': ['original_bank_name', 'bank_name', 'original_bank', 'bank', 'financial_institution', 'banking_institution', 'lending_bank', 'originating_bank', 'payday_bank', 'loan_bank'],
  'original_bank_routing_number': ['original_bank_routing_number', 'bank_routing_number', 'routing_number', 'routing', 'routing_num', 'aba_number', 'aba_routing', 'bank_routing', 'originating_routing', 'payday_routing'],
  'original_bank_account_number': ['original_bank_account_number', 'bank_account_number', 'account_number', 'bank_account', 'checking_account', 'savings_account', 'originating_account', 'payday_account', 'loan_account', 'debit_account'],
  'original_bank_account_type': ['original_bank_account_type', 'bank_account_type', 'account_type', 'account_kind', 'checking_savings', 'account_category', 'banking_type', 'originating_account_type', 'payday_account_type'],
  'original_bank_account_holder': ['original_bank_account_holder', 'bank_account_holder', 'account_holder', 'account_owner', 'account_name', 'bank_holder', 'originating_holder', 'payday_holder', 'loan_holder'],
  'original_bank_verified': ['original_bank_verified', 'bank_verified', 'account_verified', 'verification_status', 'bank_verification', 'account_verification', 'originating_verified', 'payday_verified'],
  'original_bank_verification_date': ['original_bank_verification_date', 'bank_verification_date', 'verification_date', 'account_verification_date', 'bank_verified_date', 'originating_verification_date', 'payday_verification_date'],
  'original_bank_verification_method': ['original_bank_verification_method', 'bank_verification_method', 'verification_method', 'account_verification_method', 'bank_verify_method', 'originating_verification_method', 'payday_verification_method']
}

// Data type detection patterns
const DATA_TYPE_PATTERNS = {
  date: /(date|dt|time|created|updated|opened|closed|due|expiry|expiration|start|end|begin|finish)/i,
  number: /(amount|balance|bal|amt|sum|total|count|number|num|qty|quantity|price|cost|fee|charge|payment|paid|due|owed|debt|loan|credit|debit|income|salary|score|rate|percent|percentage|pct|ratio|average|avg|mean|median|min|max)/i,
  phone: /(phone|tel|telephone|mobile|cell|fax)/i,
  email: /(email|e_mail|mail|contact)/i,
  ssn: /(ssn|social|tax|taxid)/i,
  zip: /(zip|postal|postcode)/i
}

// Enhanced fuzzy matching function with robust term matching
function fuzzyMatch(fieldName: string, targetField: string): number {
  // Normalize both strings for comparison
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Replace symbols with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim()
  }
  
  const normalizedField = normalize(fieldName)
  const normalizedTarget = normalize(targetField)
  
  // Exact match after normalization
  if (normalizedField === normalizedTarget) {
    return 1.0
  }
  
  // Remove all spaces for space-insensitive comparison
  const fieldNoSpaces = normalizedField.replace(/\s/g, '')
  const targetNoSpaces = normalizedTarget.replace(/\s/g, '')
  
  // Exact match without spaces
  if (fieldNoSpaces === targetNoSpaces) {
    return 0.95
  }
  
  // Split into words for word-based matching
  const fieldWords = normalizedField.split(' ')
  const targetWords = normalizedTarget.split(' ')
  
  // Common abbreviations and synonyms mapping
  const abbreviations: Record<string, string[]> = {
    'acct': ['account'],
    'acnt': ['account'],
    'acc': ['account'],
    'num': ['number'],
    'no': ['number'],
    '#': ['number'],
    'amt': ['amount'],
    'bal': ['balance'],
    'orig': ['original'],
    'curr': ['current'],
    'prev': ['previous'],
    'addr': ['address'],
    'add': ['address'],
    'ph': ['phone'],
    'tel': ['phone'],
    'mobile': ['phone'],
    'cell': ['phone'],
    'em': ['email'],
    'e-mail': ['email'],
    'ssn': ['social', 'security'],
    'socialsecurity': ['social', 'security'],
    'socialsecuritynumber': ['social', 'security'],
    'dob': ['date', 'birth'],
    'bday': ['date', 'birth'],
    'birthday': ['date', 'birth'],
    'emp': ['employer'],
    'work': ['employer'],
    'job': ['employer'],
    'occ': ['occupation'],
    'title': ['occupation'],
    'inc': ['income'],
    'sal': ['salary'],
    'pay': ['payment'],
    'pmt': ['payment'],
    'fee': ['fees'],
    'int': ['interest'],
    'rate': ['interest'],
    'coll': ['collection'],
    'settle': ['settlement'],
    'charge': ['charge_off'],
    'charged': ['charge_off'],
    'loan': ['loan_date'],
    'open': ['opened'],
    'start': ['opened'],
    'last_payment': ['last_payment'],
    'final': ['last_payment'],
    'next': ['next_payment'],
    'due': ['payment_due'],
    'plan': ['payment_plan'],
    'status': ['account_status'],
    'account_type': ['account_type'],
    'subtype': ['account_subtype'],
    'priority': ['collection_priority'],
    'collector': ['assigned_collector'],
    'agent': ['assigned_collector'],
    'rep': ['assigned_collector'],
    'name': ['first_name', 'last_name', 'middle_name'],
    'first': ['first_name'],
    'firstname': ['first_name'],
    'last': ['last_name'],
    'lastname': ['last_name'],
    'middle': ['middle_name'],
    'middlename': ['middle_name'],
    'prefix': ['name_prefix'],
    'suffix': ['name_suffix'],
    'city': ['city'],
    'worked': ['last_activity_date'],
    'last_worked': ['last_activity_date'],
    'lastworked': ['last_activity_date'],
    'lastworkdate': ['last_activity_date'],
    'lastworkdt': ['last_activity_date'],
    'activity': ['last_activity_date'],
    'last_activity': ['last_activity_date'],
    'worked_date': ['last_activity_date'],
    'work_date': ['last_activity_date'],
    'workdate': ['last_activity_date'],
    'state': ['state'],
    'zip': ['zipcode'],
    'bank': ['original_bank_name'],
    'bank_name': ['original_bank_name'],
    'original_bank': ['original_bank_name'],
    'originalcreditor': ['original_creditor'],
    'original_cred': ['original_creditor'],
    'orig_creditor': ['original_creditor'],
    'origcreditor': ['original_creditor'],
    'custom': ['custom_field'],
    'custom_field': ['custom_field'],
    'custom1': ['custom_field'],
    'custom2': ['custom_field'],
    'custom3': ['custom_field'],
    'postal': ['zipcode'],
    'county': ['county'],
    'country': ['country'],
    'primary': ['primary'],
    'main': ['primary'],
    'secondary': ['secondary'],
    'alt': ['secondary'],
    'personal': ['personal'],
    'business': ['business'],
    'company': ['employer'],
    'corp': ['employer'],
    'llc': ['employer'],
    'ltd': ['employer'],
    'do_not': ['do_not'],
    'dont': ['do_not'],
    'dnt': ['do_not'],
    'dnc': ['do_not_call'],
    'dnm': ['do_not_mail'],
    'dne': ['do_not_email'],
    'bankruptcy': ['bankruptcy_filed'],
    'bk': ['bankruptcy_filed'],
    'military': ['active_military'],
    'mil': ['active_military'],
    'veteran': ['active_military'],
    'vet': ['active_military'],
    'hardship': ['hardship_declared'],
    'hardship_type': ['hardship_type'],
    'portfolio': ['portfolio_name'],
    'client': ['client_name'],
    'creditor': ['original_creditor', 'current_creditor'],
    'current_creditor': ['current_creditor']
  }
  
  // Expand abbreviations in field words
  const expandAbbreviations = (words: string[]): string[] => {
    const expanded: string[] = []
    for (const word of words) {
      if (abbreviations[word]) {
        expanded.push(...abbreviations[word])
      } else {
        expanded.push(word)
      }
    }
    return expanded
  }
  
  const expandedFieldWords = expandAbbreviations(fieldWords)
  const expandedTargetWords = expandAbbreviations(targetWords)
  
  // Calculate word overlap score
  let matchedWords = 0
  let totalWords = Math.max(expandedFieldWords.length, expandedTargetWords.length)
  
  for (const fieldWord of expandedFieldWords) {
    for (const targetWord of expandedTargetWords) {
      // Exact word match
      if (fieldWord === targetWord) {
        matchedWords++
        break
      }
      // Partial word match (for compound words like "account_number")
      if (targetWord.includes(fieldWord) || fieldWord.includes(targetWord)) {
        matchedWords += 0.8
        break
      }
      // Levenshtein distance for similar words
      const distance = levenshteinDistance(fieldWord, targetWord)
      const maxLength = Math.max(fieldWord.length, targetWord.length)
      if (maxLength > 0 && distance / maxLength < 0.3) {
        matchedWords += 0.6
        break
      }
    }
  }
  
  const wordOverlapScore = totalWords > 0 ? matchedWords / totalWords : 0
  
  // Calculate substring match score (space-insensitive)
  const substringScore = calculateSubstringScore(fieldNoSpaces, targetNoSpaces)
  
  // Calculate data type similarity
  const dataTypeScore = getDataTypeSimilarity(fieldName, targetField)
  
  // Check for space-insensitive exact matches with abbreviations
  const fieldWordsNoSpaces = fieldNoSpaces.split(/(?=[A-Z])|_/).map(w => w.toLowerCase())
  const targetWordsNoSpaces = targetNoSpaces.split(/(?=[A-Z])|_/).map(w => w.toLowerCase())
  
  let spaceInsensitiveScore = 0
  for (const fieldWord of fieldWordsNoSpaces) {
    for (const targetWord of targetWordsNoSpaces) {
      if (fieldWord === targetWord) {
        spaceInsensitiveScore += 0.3
      } else if (abbreviations[fieldWord] && abbreviations[fieldWord].includes(targetWord)) {
        spaceInsensitiveScore += 0.25
      } else if (abbreviations[targetWord] && abbreviations[targetWord].includes(fieldWord)) {
        spaceInsensitiveScore += 0.25
      }
    }
  }
  
  // Weighted combination of scores
  const finalScore = (wordOverlapScore * 0.4) + (substringScore * 0.3) + (dataTypeScore * 0.1) + (spaceInsensitiveScore * 0.2)
  
  return Math.min(finalScore, 1.0)
}

// Calculate substring match score
function calculateSubstringScore(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  // Find the longest common substring
  let maxLength = 0
  for (let i = 0; i < shorter.length; i++) {
    for (let j = i + 1; j <= shorter.length; j++) {
      const substring = shorter.substring(i, j)
      if (longer.includes(substring) && substring.length > maxLength) {
        maxLength = substring.length
      }
    }
  }
  
  return maxLength / longer.length
}

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

// Data type detection
function getDataType(fieldName: string): string | null {
  const fieldLower = fieldName.toLowerCase()
  
  if (DATA_TYPE_PATTERNS.date.test(fieldLower)) return 'date'
  if (DATA_TYPE_PATTERNS.number.test(fieldLower)) return 'number'
  if (DATA_TYPE_PATTERNS.phone.test(fieldLower)) return 'phone'
  if (DATA_TYPE_PATTERNS.email.test(fieldLower)) return 'email'
  if (DATA_TYPE_PATTERNS.ssn.test(fieldLower)) return 'ssn'
  if (DATA_TYPE_PATTERNS.zip.test(fieldLower)) return 'zip'
  
  return null
}

// Auto-match function
function autoMatchFields(headers: string[], requiredFields: string[], optionalFields: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const allFields = [...requiredFields, ...optionalFields]
  const usedHeaders = new Set<string>()
  
  // Group fields by type for better matching
  const emailFields = allFields.filter(f => f.includes('email'))
  const phoneFields = allFields.filter(f => f.includes('phone'))
  const otherFields = allFields.filter(f => !f.includes('email') && !f.includes('phone'))
  
  // First pass: exact matches and high confidence matches (score >= 0.6)
  for (const field of otherFields) {
    let bestMatch = ''
    let bestScore = 0
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue
      
      const score = fuzzyMatch(header, field)
      console.log(`🔍 [AUTO MATCH] ${header} → ${field}: score ${score}`)
      
      if (score > bestScore && score >= 0.6) {
        bestScore = score
        bestMatch = header
      }
    }
    
    if (bestMatch) {
      console.log(`✅ [AUTO MATCH] Auto-mapped ${field} to ${bestMatch} (score: ${bestScore})`)
      mapping[field] = bestMatch
      usedHeaders.add(bestMatch)
    } else {
      console.log(`❌ [AUTO MATCH] No match found for ${field} (threshold: 0.6)`)
    }
  }
  
  // Handle email fields dynamically
  if (emailFields.length > 0) {
    const emailHeaders = headers.filter(h => 
      h.toLowerCase().includes('email') || 
      h.toLowerCase().includes('em') ||
      h.toLowerCase().includes('e-mail')
    ).filter(h => !usedHeaders.has(h))
    
    emailHeaders.forEach((header, index) => {
      const fieldName = index === 0 ? 'email_primary' : `email_primary_${index + 1}`
      mapping[fieldName] = header
      usedHeaders.add(header)
    })
  }
  
  // Handle phone fields dynamically
  if (phoneFields.length > 0) {
    const phoneHeaders = headers.filter(h => 
      h.toLowerCase().includes('phone') || 
      h.toLowerCase().includes('ph') ||
      h.toLowerCase().includes('tel') ||
      h.toLowerCase().includes('mobile') ||
      h.toLowerCase().includes('cell')
    ).filter(h => !usedHeaders.has(h))
    
    phoneHeaders.forEach((header, index) => {
      const fieldName = index === 0 ? 'phone_primary' : `phone_primary_${index + 1}`
      mapping[fieldName] = header
      usedHeaders.add(header)
    })
  }
  
  // Special handling for last_activity_date with lower threshold
  if (allFields.includes('last_activity_date') && !mapping['last_activity_date']) {
    const activityHeaders = headers.filter(h => 
      h.toLowerCase().includes('work') || 
      h.toLowerCase().includes('activity') ||
      h.toLowerCase().includes('lastworked') ||
      h.toLowerCase().includes('last_worked')
    ).filter(h => !usedHeaders.has(h))
    
    if (activityHeaders.length > 0) {
      const bestHeader = activityHeaders[0]
      console.log(`🎯 [SPECIAL MATCH] Auto-mapped last_activity_date to ${bestHeader}`)
      mapping['last_activity_date'] = bestHeader
      usedHeaders.add(bestHeader)
    }
  }
  
  // Second pass: lower confidence matches (score >= 0.3) for remaining fields
  for (const field of otherFields) {
    if (mapping[field]) continue
    
    let bestMatch = ''
    let bestScore = 0
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue
      
      const score = fuzzyMatch(header, field)
      if (score > bestScore && score >= 0.3) {
        bestScore = score
        bestMatch = header
      }
    }
    
    if (bestMatch) {
      mapping[field] = bestMatch
      usedHeaders.add(bestMatch)
    }
  }
  
  return mapping
}

// Get data type similarity between field names
function getDataTypeSimilarity(fieldName: string, targetField: string): number {
  const fieldType = getDataType(fieldName)
  const targetType = getDataType(targetField)
  
  if (fieldType && targetType && fieldType === targetType) {
    return 0.8
  }
  
  // Check for common patterns
  const fieldLower = fieldName.toLowerCase()
  const targetLower = targetField.toLowerCase()
  
  // Date patterns
  if ((fieldLower.includes('date') || fieldLower.includes('dob') || fieldLower.includes('birth')) &&
      (targetLower.includes('date') || targetLower.includes('dob') || targetLower.includes('birth'))) {
    return 0.7
  }
  
  // Number patterns
  if ((fieldLower.includes('number') || fieldLower.includes('num') || fieldLower.includes('#')) &&
      (targetLower.includes('number') || targetLower.includes('num') || targetLower.includes('#'))) {
    return 0.7
  }
  
  // Amount/balance patterns
  if ((fieldLower.includes('amount') || fieldLower.includes('balance') || fieldLower.includes('amt') || fieldLower.includes('bal')) &&
      (targetLower.includes('amount') || targetLower.includes('balance') || targetLower.includes('amt') || targetLower.includes('bal'))) {
    return 0.7
  }
  
  return 0.0
}

interface ImportTemplate {
  id: string
  name: string
  description: string | null
  import_type: string
  field_mappings: any
  validation_rules: any
  created_at: string | null
  updated_at: string | null
}

interface FieldMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (mapping: Record<string, string>, templateId?: string) => void
  onMappingUpdate?: (mapping: Record<string, string>) => void
  headers: string[]
  requiredFields: string[]
  optionalFields?: string[]
  initialMapping?: Record<string, string>
  importType: string
  templates: ImportTemplate[]
  onSaveTemplate?: (template: Partial<ImportTemplate>) => Promise<void>
  onUpdateTemplate?: (templateId: string, template: Partial<ImportTemplate>) => Promise<void>
  onDeleteTemplate?: (templateId: string) => Promise<void>
}

export default function FieldMappingModal({
  isOpen,
  onClose,
  onConfirm,
  onMappingUpdate,
  headers,
  requiredFields,
  optionalFields = [],
  initialMapping = {},
  importType,
  templates,
  onSaveTemplate,
  onUpdateTemplate,
  onDeleteTemplate
}: FieldMappingModalProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [editingTemplate, setEditingTemplate] = useState<ImportTemplate | null>(null)
  const [templateApplied, setTemplateApplied] = useState(false)
  const [mappingUpdated, setMappingUpdated] = useState(false)
  const [showMappingMergeDialog, setShowMappingMergeDialog] = useState(false)
  const [mappingMergeData, setMappingMergeData] = useState<{
    oldMapping: Record<string, string>
    newMapping: Record<string, string>
    droppedFields: string[]
    templateName: string
  } | null>(null)
  
  // Track mapping source (auto vs manual)
  const [mappingSource, setMappingSource] = useState<Record<string, 'auto' | 'manual' | 'template'>>({})
  
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    required: false,
    account: false,
    debtor: false,
    emails: false,
    phones: false
  })
  
  // Dynamic field counts
  const [emailCount, setEmailCount] = useState(1)
  const [phoneCount, setPhoneCount] = useState(1)

  const filteredTemplates = templates.filter(t => t.import_type === importType)

  useEffect(() => {
    setMapping(initialMapping)
    // Initialize mapping source for existing mappings
    const initialSource: Record<string, 'auto' | 'manual' | 'template'> = {}
    Object.keys(initialMapping).forEach(field => {
      initialSource[field] = 'template'
    })
    setMappingSource(initialSource)
  }, [initialMapping])

  const handleChange = (field: string, value: string) => {
    console.log('🔍 [MAPPING CHANGE] Field mapping updated:')
    console.log('  - Field:', field)
    console.log('  - Old value:', mapping[field])
    console.log('  - New value:', value)
    console.log('  - Previous mapping state:', mapping)
    console.log('  - Previous mapping keys:', Object.keys(mapping))
    
    setMapping(prev => {
      const newMapping = {
        ...prev,
        [field]: value
      }
      console.log('  - New mapping state:', newMapping)
      console.log('  - New mapping keys:', Object.keys(newMapping))
      return newMapping
    })
    
    // Mark as manual mapping
    setMappingSource(prev => {
      const newSource: Record<string, 'auto' | 'manual' | 'template'> = {
        ...prev,
        [field]: 'manual'
      }
      console.log('  - Updated mapping source:', newSource)
      return newSource
    })
  }

  const handleTemplateChange = (templateId: string) => {
    console.log('🔍 [TEMPLATE CHANGE] Template selection changed:')
    console.log('  - Selected template ID:', templateId)
    
    setSelectedTemplateId(templateId)
    if (templateId) {
      const template = templates.find(t => t.id === templateId)
      console.log('  - Found template:', template)
      console.log('  - Template field_mappings:', template?.field_mappings)
      
      if (template && template.field_mappings) {
        console.log('  - Setting mapping from template:', template.field_mappings)
        setMapping(template.field_mappings)
        
        // Mark all template mappings
        const templateSource: Record<string, 'auto' | 'manual' | 'template'> = {}
        Object.keys(template.field_mappings).forEach(field => {
          templateSource[field] = 'template'
        })
        console.log('  - Setting mapping source:', templateSource)
        setMappingSource(templateSource)
        setTemplateApplied(true)
        console.log('  - Template applied successfully')
      }
    } else {
      console.log('  - No template selected, clearing mapping')
      setMapping({})
      setMappingSource({})
      setTemplateApplied(false)
    }
  }

  const handleAutoMatch = () => {
    console.log('🔍 [AUTO MATCH] Auto-matching fields:')
    console.log('  - Headers available:', headers)
    console.log('  - Required fields:', requiredFields)
    console.log('  - Optional fields:', optionalFields)
    console.log('  - Current mapping before auto-match:', mapping)
    
    const autoMapped = autoMatchFields(headers, requiredFields, optionalFields)
    console.log('  - Auto-matched results:', autoMapped)
    
    // Preserve existing mappings and only auto-match unmapped fields
    const updatedMapping = { ...mapping }
    const updatedSource = { ...mappingSource }
    
    Object.keys(autoMapped).forEach(field => {
      // Only auto-match if the field is not already mapped
      if (!mapping[field] || mapping[field].trim() === '') {
        updatedMapping[field] = autoMapped[field]
        updatedSource[field] = 'auto'
        console.log(`  - Auto-mapped ${field} to ${autoMapped[field]}`)
      } else {
        console.log(`  - Skipped ${field} (already mapped to ${mapping[field]})`)
      }
    })
    
    console.log('  - Final mapping after auto-match:', updatedMapping)
    console.log('  - Final mapping source after auto-match:', updatedSource)
    
    setMapping(updatedMapping)
    setMappingSource(updatedSource)
  }

  const checkForDroppedFields = (oldMapping: Record<string, string>, newMapping: Record<string, string>): string[] => {
    const droppedFields: string[] = []
    Object.keys(oldMapping).forEach(field => {
      if (!newMapping[field] || newMapping[field].trim() === '') {
        droppedFields.push(field)
      }
    })
    return droppedFields
  }

  const handleUpdateMappingWithMergeCheck = async () => {
    console.log('🔘 [BUTTON] Update Mapping button clicked!')
    console.log('🔍 [UPDATE MAPPING] Current state:')
    console.log('  - selectedTemplateId:', selectedTemplateId)
    console.log('  - current mapping state:', mapping)
    console.log('  - onUpdateTemplate prop exists:', !!onUpdateTemplate)
    
    if (selectedTemplateId && onUpdateTemplate) {
      try {
        // Find the current template to get its details
        const currentTemplate = templates.find(t => t.id === selectedTemplateId)
        if (currentTemplate) {
          console.log('🔍 [UPDATE MAPPING] Found current template:', currentTemplate)
          console.log('🔍 [UPDATE MAPPING] Original field_mappings:', currentTemplate.field_mappings)
          console.log('🔍 [UPDATE MAPPING] New field_mappings to save:', mapping)
          
          // Check for dropped fields
          const droppedFields = checkForDroppedFields(currentTemplate.field_mappings || {}, mapping)
          console.log('🔍 [UPDATE MAPPING] Dropped fields detected:', droppedFields)
          
          if (droppedFields.length > 0) {
            // Show merge dialog
            setMappingMergeData({
              oldMapping: currentTemplate.field_mappings || {},
              newMapping: mapping,
              droppedFields,
              templateName: currentTemplate.name
            })
            setShowMappingMergeDialog(true)
          } else {
            // No dropped fields, proceed with update
            await updateTemplateMapping(currentTemplate, mapping)
          }
        } else {
          console.error('❌ [UPDATE MAPPING] Could not find current template')
          alert('Error: Could not find current template')
        }
      } catch (error) {
        console.error('❌ [UPDATE MAPPING] Failed to update template:', error)
        alert('Error updating template: ' + (error instanceof Error ? error.message : String(error)))
      }
    } else {
      // Just update the mapping in the parent component for session use
      console.log('🔍 [UPDATE MAPPING] No template selected, updating session mapping only')
      if (onMappingUpdate) {
        onMappingUpdate(mapping)
      }
      setMappingUpdated(true)
      setTimeout(() => setMappingUpdated(false), 2000)
    }
  }

  const updateTemplateMapping = async (template: ImportTemplate, finalMapping: Record<string, string>) => {
    try {
      const result = await onUpdateTemplate!(template.id, {
        ...template,
        field_mappings: finalMapping
      })
      
      console.log('✅ [UPDATE MAPPING] Template update result:', result)
      
      // Show success feedback
      setMappingUpdated(true)
      setTimeout(() => setMappingUpdated(false), 2000)
      alert('Template field mappings updated in database!')
    } catch (error) {
      console.error('❌ [UPDATE MAPPING] Failed to update template:', error)
      alert('Error updating template: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    
    try {
      await onSaveTemplate?.({
        name: templateName,
        description: templateDescription,
        import_type: importType,
        field_mappings: mapping
      })
      setShowSaveTemplate(false)
      setTemplateName('')
      setTemplateDescription('')
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }

  const handleUpdateTemplate = async () => {
    console.log('🚀 [FIELD MAPPING] handleUpdateTemplate called!')
    console.log('🔍 [FIELD MAPPING] Detailed state analysis:')
    console.log('  - editingTemplate exists:', !!editingTemplate)
    console.log('  - editingTemplate.id:', editingTemplate?.id)
    console.log('  - editingTemplate.name:', editingTemplate?.name)
    console.log('  - editingTemplate.field_mappings:', editingTemplate?.field_mappings)
    console.log('  - templateName:', templateName)
    console.log('  - templateName.trim():', templateName.trim())
    console.log('  - templateDescription:', templateDescription)
    console.log('  - current mapping state:', mapping)
    console.log('  - mapping type:', typeof mapping)
    console.log('  - mapping keys count:', Object.keys(mapping).length)
    console.log('  - mapping entries:', Object.entries(mapping))
    console.log('  - onUpdateTemplate prop exists:', !!onUpdateTemplate)
    console.log('  - onUpdateTemplate type:', typeof onUpdateTemplate)
    
    if (!editingTemplate || !templateName.trim()) {
      console.log('❌ [FIELD MAPPING] Validation failed:')
      console.log('  - editingTemplate missing:', !editingTemplate)
      console.log('  - templateName empty:', !templateName.trim())
      return
    }
    
    try {
      console.log('🔄 [FIELD MAPPING] Starting template update...')
      
      const updateData = {
        name: templateName,
        description: templateDescription,
        import_type: editingTemplate.import_type,
        field_mappings: mapping
      }
      
      console.log('🔄 [FIELD MAPPING] Update data being sent:')
      console.log('  - updateData:', updateData)
      console.log('  - updateData.field_mappings:', updateData.field_mappings)
      console.log('  - updateData.field_mappings type:', typeof updateData.field_mappings)
      console.log('  - updateData.field_mappings keys:', Object.keys(updateData.field_mappings))
      
      if (onUpdateTemplate) {
        console.log('🔄 [FIELD MAPPING] Calling onUpdateTemplate with:')
        console.log('  - templateId:', editingTemplate.id)
        console.log('  - updateData:', updateData)
        
        const result = await onUpdateTemplate(editingTemplate.id, updateData)
        console.log('✅ [FIELD MAPPING] onUpdateTemplate completed with result:', result)
      } else {
        console.log('❌ [FIELD MAPPING] onUpdateTemplate prop is undefined!')
        return
      }
      
      console.log('✅ [FIELD MAPPING] Template update completed successfully')
      console.log('🔄 [FIELD MAPPING] Cleaning up UI state...')
      
      setShowTemplateManager(false)
      setEditingTemplate(null)
      setTemplateName('')
      setTemplateDescription('')
      
      console.log('✅ [FIELD MAPPING] UI state cleaned up')
    } catch (error) {
      console.error('❌ [FIELD MAPPING] Failed to update template:', error)
      console.error('❌ [FIELD MAPPING] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    
    try {
      await onDeleteTemplate?.(templateId)
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const missingRequired = requiredFields.filter(f => !mapping[f])

  // Get available headers (excluding already mapped ones)
  const getAvailableHeaders = (currentField: string) => {
    const usedHeaders = Object.values(mapping).filter(header => header && header !== mapping[currentField])
    return headers.filter(header => !usedHeaders.includes(header))
  }

  // Group fields by type
  const fieldGroups = {
    required: requiredFields,
    account: optionalFields.filter(f => 
      f.includes('account') || f.includes('balance') || f.includes('payment') || 
      f.includes('interest') || f.includes('fee') || f.includes('settlement') ||
      f.includes('collection') || f.includes('charge_off') || f.includes('loan_date') ||
      f.includes('bank') || f.includes('routing') || f.includes('checking') || f.includes('savings') ||
      f.includes('aba') || f.includes('financial_institution') || f.includes('banking_institution') ||
      f.includes('lending') || f.includes('originating') || f.includes('payday') || f.includes('loan') ||
      f.includes('debit') || f.includes('holder') || f.includes('creditor') || f.includes('date_opened') ||
      f.includes('last_payment_date') || f.includes('last_activity_date') || f.includes('debt_age')
    ),
    debtor: optionalFields.filter(f => 
      (f.includes('name') || f.includes('address') || f.includes('ssn') || 
      f.includes('dob') || f.includes('employer') || f.includes('occupation') ||
      f.includes('income') || f.includes('county') || f.includes('country')) &&
      !f.includes('bank') && !f.includes('routing') && !f.includes('account_holder') && 
      !f.includes('financial_institution') && !f.includes('banking_institution')
    ),
    emails: optionalFields.filter(f => f.includes('email')),
    phones: optionalFields.filter(f => f.includes('phone'))
  }

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const addEmailField = () => {
    setEmailCount(prev => prev + 1)
  }

  const removeEmailField = () => {
    if (emailCount > 1) {
      setEmailCount(prev => prev - 1)
    }
  }

  const addPhoneField = () => {
    setPhoneCount(prev => prev + 1)
  }

  const removePhoneField = () => {
    if (phoneCount > 1) {
      setPhoneCount(prev => prev - 1)
    }
  }

  const getOrdinalSuffix = (num: number) => {
    const j = num % 10
    const k = num % 100
    if (j === 1 && k !== 11) return 'st'
    if (j === 2 && k !== 12) return 'nd'
    if (j === 3 && k !== 13) return 'rd'
    return 'th'
  }

  // Get styling for mapped fields
  const getFieldStyling = (field: string) => {
    const isMapped = !!mapping[field]
    const source = mappingSource[field]
    
    if (!isMapped) {
      return {
        containerClass: 'border-gray-200 bg-gray-50',
        labelClass: 'text-gray-600',
        selectClass: 'border-gray-300 bg-white',
        badge: null
      }
    }
    
    switch (source) {
      case 'auto':
        return {
          containerClass: 'border-green-200 bg-green-50',
          labelClass: 'text-green-800 font-medium',
          selectClass: 'border-green-500 bg-green-50',
          badge: { text: 'Auto', color: 'bg-green-100 text-green-800 border-green-300' }
        }
      case 'manual':
        return {
          containerClass: 'border-blue-200 bg-blue-50',
          labelClass: 'text-blue-800 font-medium',
          selectClass: 'border-blue-500 bg-blue-50',
          badge: { text: 'Manual', color: 'bg-blue-100 text-blue-800 border-blue-300' }
        }
      case 'template':
        return {
          containerClass: 'border-purple-200 bg-purple-50',
          labelClass: 'text-purple-800 font-medium',
          selectClass: 'border-purple-500 bg-purple-50',
          badge: { text: 'Template', color: 'bg-purple-100 text-purple-800 border-purple-300' }
        }
      default:
        return {
          containerClass: 'border-gray-200 bg-gray-50',
          labelClass: 'text-gray-600',
          selectClass: 'border-gray-300 bg-white',
          badge: null
        }
    }
  }

  const renderFieldGroup = (groupName: string, fields: string[], title: string, isCollapsible = true) => {
    if (fields.length === 0) return null

    const isCollapsed = collapsedSections[groupName]
    const mappedCount = fields.filter(f => mapping[f]).length
    const totalCount = fields.length

    return (
      <Card className="mb-4">
        <CardHeader 
          className={`pb-3 ${isCollapsible ? 'cursor-pointer hover:bg-gray-50' : ''}`}
          onClick={() => isCollapsible && toggleSection(groupName)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isCollapsible && (
                isCollapsed ? (
                  <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                )
              )}
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              <Badge variant="outline" className="text-xs">
                {mappedCount}/{totalCount} mapped
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        {!isCollapsed && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fields.map(field => {
                const styling = getFieldStyling(field)
                return (
                  <div key={field} className={`p-3 rounded-lg border-2 transition-all duration-200 ${styling.containerClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className={`block text-sm font-medium ${styling.labelClass}`}>
                        {field} {requiredFields.includes(field) && '*'}
                      </Label>
                      {styling.badge && (
                        <Badge variant="outline" className={`text-xs ${styling.badge.color}`}>
                          {styling.badge.text}
                        </Badge>
                      )}
                    </div>
                    <select
                      value={mapping[field] || ''}
                      onChange={(e) => handleChange(field, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${styling.selectClass}`}
                    >
                      <option value="">Select column...</option>
                      {getAvailableHeaders(field).map(header => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const renderDynamicFieldGroup = (groupName: string, baseFields: string[], title: string, count: number, onAdd: () => void, onRemove: () => void) => {
    const isCollapsed = collapsedSections[groupName]
    
    // Get all mapped fields for this group (base field + numbered variants)
    const getAllMappedFields = () => {
      const mappedFields: string[] = []
      const baseField = baseFields[0]
      
      // Check base field
      if (mapping[baseField]) {
        mappedFields.push(baseField)
      }
      
      // Check numbered variants
      for (let i = 2; i <= 10; i++) { // Check up to 10 variants
        const variantField = `${baseField}_${i}`
        if (mapping[variantField]) {
          mappedFields.push(variantField)
        }
      }
      
      return mappedFields
    }
    
    const mappedFields = getAllMappedFields()
    const mappedCount = mappedFields.length

    return (
      <Card className="mb-4">
        <CardHeader 
          className="pb-3 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection(groupName)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isCollapsed ? (
                <ChevronRightIcon className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
              )}
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              <Badge variant="outline" className="text-xs">
                {mappedCount} mapped
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd()
                }}
                className="h-8 w-8 p-0"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                disabled={count <= 1}
                className="h-8 w-8 p-0"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isCollapsed && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Show existing mapped fields first */}
              {mappedFields.map((field, index) => {
                const styling = getFieldStyling(field)
                return (
                  <div key={field} className={`p-3 rounded-lg border-2 transition-all duration-200 ${styling.containerClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className={`block text-sm font-medium ${styling.labelClass}`}>
                        {index === 0 ? 'Primary' : `${index + 1}${getOrdinalSuffix(index + 1)}`} {baseFields[0].replace('_', ' ')}
                      </Label>
                      {styling.badge && (
                        <Badge variant="outline" className={`text-xs ${styling.badge.color}`}>
                          {styling.badge.text}
                        </Badge>
                      )}
                    </div>
                    <select
                      value={mapping[field] || ''}
                      onChange={(e) => handleChange(field, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${styling.selectClass}`}
                    >
                      <option value="">Select column...</option>
                      {getAvailableHeaders(field).map(header => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
              
              {/* Show additional empty fields up to the current count */}
              {Array.from({ length: Math.max(0, count - mappedFields.length) }, (_, index) => {
                const fieldIndex = mappedFields.length + index
                const field = fieldIndex === 0 ? baseFields[0] : `${baseFields[0]}_${fieldIndex + 1}`
                const styling = getFieldStyling(field)
                return (
                  <div key={`empty-${field}`} className={`p-3 rounded-lg border-2 transition-all duration-200 ${styling.containerClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className={`block text-sm font-medium ${styling.labelClass}`}>
                        {fieldIndex === 0 ? 'Primary' : `${fieldIndex + 1}${getOrdinalSuffix(fieldIndex + 1)}`} {baseFields[0].replace('_', ' ')}
                      </Label>
                      {styling.badge && (
                        <Badge variant="outline" className={`text-xs ${styling.badge.color}`}>
                          {styling.badge.text}
                        </Badge>
                      )}
                    </div>
                    <select
                      value={mapping[field] || ''}
                      onChange={(e) => handleChange(field, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${styling.selectClass}`}
                    >
                      <option value="">Select column...</option>
                      {getAvailableHeaders(field).map(header => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose} maxWidth="max-w-[95vw]">
        <DialogContent className="h-[90vh]">
          <DialogHeader>
            <DialogTitle>Field Mapping & Template Management</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 h-full overflow-hidden flex flex-col">
            {/* Template Selection */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block mb-2">Load Template</Label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">No template (manual mapping)</option>
                      {filteredTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Selecting a template automatically applies its field mappings
                    </p>
                    {selectedTemplateId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleTemplateChange(selectedTemplateId)}
                        className={`mt-2 ${
                          templateApplied 
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                            : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                        {templateApplied ? 'Template Applied ✓' : 'Apply Template'}
                      </Button>
                    )}
                  </div>
                  
                  {selectedTemplateId && (
                    <div>
                      <Label className="block mb-2">Template Info</Label>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        {(() => {
                          const template = templates.find(t => t.id === selectedTemplateId)
                          return template ? (
                            <div>
                              <p className="font-medium text-blue-900">{template.name}</p>
                              {template.description && (
                                <p className="text-sm text-blue-700">{template.description}</p>
                              )}
                              <Badge variant="outline" className="mt-1">
                                {template.import_type}
                              </Badge>
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                                ✓ Template applied automatically
                              </div>
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Template Management Buttons */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateManager(true)}
                    >
                      Manage Templates
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSaveTemplate(true)}
                    >
                      Save as Template
                    </Button>
                  </div>
                  {selectedTemplateId && (
                    <div className="text-sm text-blue-600 font-medium">
                      Template loaded - review mappings below
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Field Mapping Section */}
            <Card className="flex-1 overflow-y-auto">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Field Mapping</h3>
                  <Button
                    onClick={handleAutoMatch}
                    variant="outline"
                    size="sm"
                    className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 hover:from-purple-600 hover:to-blue-600"
                  >
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Auto Match Fields
                  </Button>
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  Map each field to a column from your file. Required fields are marked with *. Use Auto Match to automatically map fields based on name similarity.
                </div>
                
                {/* Validation Requirements */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-3">Import Validation Requirements</h4>
                  <div className="text-xs text-blue-800 space-y-1">
                    <div>• <strong>SSN:</strong> Must be a valid 9-digit number (leading 'Z' will be converted to '0')</div>
                    <div>• <strong>Balance:</strong> Must be $25 or higher (uses current_balance or original_balance)</div>
                    <div>• <strong>Original Account Number:</strong> Cannot be blank or empty</div>
                    <div>• <strong>Duplicate Detection:</strong> Accounts with same SSN, original account number, and balance will be skipped</div>
                    <div>• <strong>Data Quality Assessment:</strong> All accounts are automatically scored for data quality and suspicious patterns</div>
                    <div className="mt-2 text-blue-700">
                      <strong>Data Quality Scoring:</strong> Accounts are evaluated for balance anomalies, account number patterns, SSN validity, and cross-referenced with portfolio data. Critical issues will be rejected automatically.
                    </div>
                  </div>
                </div>

                {/* Mapping Legend */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Mapping Status Legend</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-100 border-2 border-green-200 rounded"></div>
                      <span className="text-green-800 font-medium">Auto</span>
                      <span className="text-gray-600">Automatically mapped</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-blue-100 border-2 border-blue-200 rounded"></div>
                      <span className="text-blue-800 font-medium">Manual</span>
                      <span className="text-gray-600">Manually selected</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-purple-100 border-2 border-purple-200 rounded"></div>
                      <span className="text-purple-800 font-medium">Template</span>
                      <span className="text-gray-600">From saved template</span>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault()
                    if (missingRequired.length === 0) {
                      onConfirm(mapping, selectedTemplateId || undefined)
                    }
                  }}
                  className="space-y-6"
                >
                  {/* Required Fields */}
                  {renderFieldGroup('required', fieldGroups.required, 'Required Fields', false)}
                  
                  {/* Account Fields */}
                  {renderFieldGroup('account', fieldGroups.account, 'Account Information')}
                  
                  {/* Debtor Fields */}
                  {renderFieldGroup('debtor', fieldGroups.debtor, 'Debtor Information')}
                  
                  {/* Email Fields */}
                  {renderDynamicFieldGroup('emails', fieldGroups.emails, 'Email Addresses', emailCount, addEmailField, removeEmailField)}
                  
                  {/* Phone Fields */}
                  {renderDynamicFieldGroup('phones', fieldGroups.phones, 'Phone Numbers', phoneCount, addPhoneField, removePhoneField)}

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      {missingRequired.length > 0 ? (
                        <span className="text-red-600">
                          {missingRequired.length} required field{missingRequired.length !== 1 ? 's' : ''} not mapped
                        </span>
                      ) : (
                        <span className="text-green-600">
                          All required fields mapped ✓
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleUpdateMappingWithMergeCheck}
                        disabled={missingRequired.length > 0}
                        className={`!border-green-600 !hover:border-green-700 ${
                          mappingUpdated 
                            ? '!bg-green-700 !text-white' 
                            : '!bg-green-600 !hover:bg-green-700 !text-white'
                        }`}
                      >
                        {mappingUpdated ? '✓ Updated!' : 'Update Mapping'}
                      </Button>
                      <Button
                        type="submit"
                        disabled={missingRequired.length > 0}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Confirm Mapping
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <Dialog open={showSaveTemplate} onOpenChange={() => setShowSaveTemplate(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save as Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter template name"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSaveTemplate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim()}
                >
                  Save Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Template Manager Modal */}
      {showTemplateManager && (
        <Dialog open={showTemplateManager} onOpenChange={() => setShowTemplateManager(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Template Manager</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto">
                {filteredTemplates.map(template => (
                  <div key={template.id} className="border border-gray-200 rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        {template.description && (
                          <p className="text-sm text-gray-600">{template.description}</p>
                        )}
                        <Badge variant="outline" className="mt-1">
                          {template.import_type}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log('🔘 [BUTTON] Edit button clicked for template:', template)
                            alert(`Editing template: ${template.name}. Check console for logs.`)
                            setEditingTemplate(template)
                            setTemplateName(template.name)
                            setTemplateDescription(template.description || '')
                            // Update the current mapping state with the template's field mappings
                            console.log('🔄 [EDIT] Setting mapping to:', template.field_mappings)
                            setMapping(template.field_mappings || {})
                            // Update mapping source to indicate these are from template
                            const templateSource: Record<string, 'auto' | 'manual' | 'template'> = {}
                            Object.keys(template.field_mappings || {}).forEach(field => {
                              templateSource[field] = 'template'
                            })
                            setMappingSource(templateSource)
                            console.log('✅ [EDIT] Template editing setup complete')
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Template editing form */}
              {editingTemplate && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <h5 className="font-medium text-blue-900 mb-4">Edit Template: {editingTemplate.name}</h5>
                  <div className="space-y-4">
                    <div>
                      <Label>Template Name</Label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Enter template name"
                      />
                    </div>
                    <div>
                      <Label>Description (Optional)</Label>
                      <textarea
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Enter description"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingTemplate(null)
                          setTemplateName('')
                          setTemplateDescription('')
                        }}
                      >
                        Cancel Edit
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          console.log('🔘 [BUTTON] Update Template button clicked!')
                          console.log('🔍 [BUTTON] Current state when Update clicked:')
                          console.log('  - editingTemplate:', editingTemplate)
                          console.log('  - templateName:', templateName)
                          console.log('  - templateDescription:', templateDescription)
                          console.log('  - current mapping state:', mapping)
                          console.log('  - original template field_mappings:', editingTemplate?.field_mappings)
                          console.log('  - mapping keys:', Object.keys(mapping))
                          console.log('  - original mapping keys:', Object.keys(editingTemplate?.field_mappings || {}))
                          
                          // Remove the alert to avoid blocking
                          handleUpdateTemplate()
                        }}
                        disabled={!templateName.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Update Template
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTemplateManager(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Field Mapping Merge Dialog */}
      {showMappingMergeDialog && mappingMergeData && (
        <Dialog open={showMappingMergeDialog} onOpenChange={() => setShowMappingMergeDialog(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Field Mapping Merge Required</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h4 className="text-sm font-medium text-yellow-900 mb-2">
                  Template "{mappingMergeData.templateName}" has {mappingMergeData.droppedFields.length} field(s) that are not mapped in the current import file.
                </h4>
                <p className="text-sm text-yellow-800">
                  These fields were previously mapped and may be used in other import files. Choose how to handle them:
                </p>
              </div>
              
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Dropped Fields:</h5>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {mappingMergeData.droppedFields.map(field => (
                    <div key={field} className="p-2 bg-gray-100 rounded border">
                      <span className="font-medium">{field}</span>
                      <span className="text-gray-600 ml-2">→ {mappingMergeData.oldMapping[field]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Choose Action:</h5>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3 p-3 border border-blue-200 rounded-md bg-blue-50">
                    <input
                      type="radio"
                      id="merge-keep"
                      name="merge-action"
                      value="keep"
                      defaultChecked
                      className="mt-1"
                    />
                    <div>
                      <label htmlFor="merge-keep" className="font-medium text-blue-900">
                        Keep All Fields (Recommended)
                      </label>
                      <p className="text-sm text-blue-800 mt-1">
                        Merge new mappings with existing ones. This preserves all historical field mappings 
                        and ensures compatibility with other import files that may use these fields.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 border border-red-200 rounded-md bg-red-50">
                    <input
                      type="radio"
                      id="merge-replace"
                      name="merge-action"
                      value="replace"
                      className="mt-1"
                    />
                    <div>
                      <label htmlFor="merge-replace" className="font-medium text-red-900">
                        Replace All Fields
                      </label>
                      <p className="text-sm text-red-800 mt-1">
                        Use only the current import file's mappings. This will remove the dropped fields 
                        from the template permanently.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMappingMergeDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const action = document.querySelector('input[name="merge-action"]:checked') as HTMLInputElement
                    if (!action) return
                    
                    try {
                      let finalMapping: Record<string, string>
                      
                      if (action.value === 'keep') {
                        // Merge: keep old mappings and add new ones
                        finalMapping = {
                          ...mappingMergeData.oldMapping,
                          ...mappingMergeData.newMapping
                        }
                        console.log('🔀 [MERGE] Keeping all fields, final mapping:', finalMapping)
                      } else {
                        // Replace: use only new mappings
                        finalMapping = mappingMergeData.newMapping
                        console.log('🔄 [MERGE] Replacing all fields, final mapping:', finalMapping)
                      }
                      
                      // Find the current template to update
                      const currentTemplate = templates.find(t => t.id === selectedTemplateId)
                      if (currentTemplate) {
                        await updateTemplateMapping(currentTemplate, finalMapping)
                      }
                      
                      // Close dialog
                      setShowMappingMergeDialog(false)
                      setMappingMergeData(null)
                    } catch (error) {
                      console.error('❌ [MERGE] Failed to process merge:', error)
                      alert('Error processing merge: ' + (error instanceof Error ? error.message : String(error)))
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Process Mapping Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
} 