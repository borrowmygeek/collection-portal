-- Create Platform Admin User Directly in Database
-- This bypasses Supabase Dashboard restrictions on free plan

-- Check if user already exists
DO $$
DECLARE
    user_exists boolean;
    user_id uuid;
BEGIN
    -- Check if user already exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@collectionportal.com') INTO user_exists;
    
    IF NOT user_exists THEN
        -- Create the user in auth.users table
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            invited_at,
            confirmation_token,
            confirmation_sent_at,
            recovery_token,
            recovery_sent_at,
            email_change_token_new,
            email_change,
            email_change_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            phone,
            phone_confirmed_at,
            phone_change,
            phone_change_token,
            phone_change_sent_at,
            email_change_token_current,
            email_change_confirm_status,
            banned_until,
            reauthentication_token,
            reauthentication_sent_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', -- instance_id (default)
            gen_random_uuid(), -- id (will be generated)
            'authenticated', -- aud
            'authenticated', -- role
            'admin@collectionportal.com', -- email
            crypt('Admin123!', gen_salt('bf')), -- encrypted_password
            now(), -- email_confirmed_at
            NULL, -- invited_at
            '', -- confirmation_token
            NULL, -- confirmation_sent_at
            '', -- recovery_token
            NULL, -- recovery_sent_at
            '', -- email_change_token_new
            '', -- email_change
            NULL, -- email_change_sent_at
            NULL, -- last_sign_in_at
            '{"provider": "email", "providers": ["email"]}'::jsonb, -- raw_app_meta_data
            '{"full_name": "Platform Administrator", "role": "platform_admin"}'::jsonb, -- raw_user_meta_data
            false, -- is_super_admin
            now(), -- created_at
            now(), -- updated_at
            NULL, -- phone
            NULL, -- phone_confirmed_at
            '', -- phone_change
            '', -- phone_change_token
            NULL, -- phone_change_sent_at
            '', -- email_change_token_current
            0, -- email_change_confirm_status
            NULL, -- banned_until
            '', -- reauthentication_token
            NULL -- reauthentication_sent_at
        );
        
        RAISE NOTICE 'User created successfully';
    ELSE
        -- Update existing user's metadata
        UPDATE auth.users 
        SET raw_user_meta_data = '{"full_name": "Platform Administrator", "role": "platform_admin"}'::jsonb,
            updated_at = now()
        WHERE email = 'admin@collectionportal.com';
        
        RAISE NOTICE 'User already exists, metadata updated';
    END IF;
    
    -- Get the user ID
    SELECT id INTO user_id FROM auth.users WHERE email = 'admin@collectionportal.com';
    
    -- Insert into platform_users table if not exists
    INSERT INTO platform_users (auth_user_id, email, full_name, role)
    VALUES (user_id, 'admin@collectionportal.com', 'Platform Administrator', 'platform_admin')
    ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now();
        
    RAISE NOTICE 'Platform user record created/updated';
END $$;

-- Verify the user was created
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at
FROM auth.users 
WHERE email = 'admin@collectionportal.com';

-- Verify the platform_users record
SELECT * FROM platform_users WHERE email = 'admin@collectionportal.com';

-- Test JWT claims function
SELECT public.get_user_claims(); 