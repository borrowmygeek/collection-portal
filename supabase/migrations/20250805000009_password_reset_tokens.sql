-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    email text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reset tokens" ON public.password_reset_tokens
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.platform_users 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins can manage all reset tokens" ON public.password_reset_tokens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.platform_users pu ON ur.user_id = pu.id
            WHERE pu.id = auth.uid() 
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        )
    );

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.password_reset_tokens 
    WHERE expires_at < now() OR used = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up expired tokens (runs daily)
-- Note: This requires pg_cron extension which may not be available in all Supabase plans
-- For now, we'll rely on application-level cleanup

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_password_reset_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_password_reset_tokens_updated_at
    BEFORE UPDATE ON public.password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_password_reset_tokens_updated_at(); 