-- Fix remaining RLS policies that are still using the old auth system
-- This migration updates the 3 policies found by the deep scan audit

-- Drop the old policies that use raw_user_meta_data
DROP POLICY IF EXISTS "Platform admins can view all buyers" ON public.master_buyers;
DROP POLICY IF EXISTS "Platform admins can manage all sales" ON public.portfolio_sales;
DROP POLICY IF EXISTS "Platform admins can access all import files" ON storage.objects;

-- Recreate the policies using the new user_roles system

-- 1. Fix master_buyers policy
CREATE POLICY "Platform admins can view all buyers" ON public.master_buyers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.platform_users pu ON ur.user_id = pu.id
            WHERE pu.id = auth.uid() 
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        )
    );

-- 2. Fix portfolio_sales policy
CREATE POLICY "Platform admins can manage all sales" ON public.portfolio_sales
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.platform_users pu ON ur.user_id = pu.id
            WHERE pu.id = auth.uid() 
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        )
    );

-- 3. Fix storage.objects policy
CREATE POLICY "Platform admins can access all import files" ON storage.objects
    FOR ALL USING (
        bucket_id = 'import-files' 
        AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.platform_users pu ON ur.user_id = pu.id
            WHERE pu.id = auth.uid() 
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        )
    );

-- Log the changes
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed 3 RLS policies that were using old auth system:';
    RAISE NOTICE '   - public.master_buyers: "Platform admins can view all buyers"';
    RAISE NOTICE '   - public.portfolio_sales: "Platform admins can manage all sales"';
    RAISE NOTICE '   - storage.objects: "Platform admins can access all import files"';
    RAISE NOTICE '';
    RAISE NOTICE 'All policies now use the new user_roles system instead of raw_user_meta_data.';
END $$; 