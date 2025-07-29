-- Create storage bucket for import files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'import-files',
    'import-files',
    false,
    10485760, -- 10MB limit
    ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the import-files bucket
CREATE POLICY "Users can upload their own import files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'import-files' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view their own import files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'import-files' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own import files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'import-files' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own import files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'import-files' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Platform admins can access all import files
CREATE POLICY "Platform admins can access all import files" ON storage.objects
    FOR ALL USING (
        bucket_id = 'import-files' AND 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    ); 