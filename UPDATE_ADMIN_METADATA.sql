-- Update Platform Admin User Metadata
-- Run this after creating the user in Supabase Dashboard → Authentication → Users

-- First, create the user if it doesn't exist (you can skip this if you already created the user via UI)
-- INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
-- VALUES (
--     'admin@collectionportal.com',
--     crypt('Admin123!', gen_salt('bf')),
--     now(),
--     now(),
--     now(),
--     '{"full_name": "Platform Administrator", "role": "platform_admin"}'::jsonb
-- );

-- Update the existing user's metadata (run this after creating the user via UI)
UPDATE auth.users 
SET raw_user_meta_data = '{"full_name": "Platform Administrator", "role": "platform_admin"}'::jsonb
WHERE email = 'admin@collectionportal.com';

-- Verify the update
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at
FROM auth.users 
WHERE email = 'admin@collectionportal.com';

-- If the platform_users record was created automatically by the trigger, update it too
UPDATE platform_users 
SET 
    full_name = 'Platform Administrator',
    role = 'platform_admin'
WHERE email = 'admin@collectionportal.com';

-- Verify the platform_users record
SELECT * FROM platform_users WHERE email = 'admin@collectionportal.com'; 