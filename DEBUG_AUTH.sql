-- Debug Authentication Setup
-- Run this to check what's happening with the auth system

-- 1. Check if the user exists in auth.users
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'admin@collectionportal.com';

-- 2. Check if the user exists in platform_users
SELECT * FROM platform_users WHERE email = 'admin@collectionportal.com';

-- 3. Check current auth.uid() (should be null if not authenticated)
SELECT auth.uid() as current_user_id;

-- 4. Check current JWT (should be null if not authenticated)
SELECT auth.jwt() as current_jwt;

-- 5. Test the JWT claims function with explicit user ID
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID from step 1
-- SELECT public.get_user_claims_for_user('YOUR_USER_ID_HERE');

-- 6. Check if RLS is enabled on platform_users
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'platform_users';

-- 7. Check RLS policies on platform_users
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'platform_users';

-- 8. Check if the trigger function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('handle_new_user', 'get_user_claims');

-- 9. Check if the trigger exists
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created'; 