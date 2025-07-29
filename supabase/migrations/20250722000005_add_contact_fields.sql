-- Add contact fields to master_agencies table
ALTER TABLE master_agencies 
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zipcode text;

-- Add contact fields to master_clients table
ALTER TABLE master_clients 
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zipcode text,
ADD COLUMN IF NOT EXISTS client_type text;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_master_agencies_contact_email ON master_agencies(contact_email);
CREATE INDEX IF NOT EXISTS idx_master_agencies_contact_phone ON master_agencies(contact_phone);
CREATE INDEX IF NOT EXISTS idx_master_agencies_city ON master_agencies(city);
CREATE INDEX IF NOT EXISTS idx_master_agencies_state ON master_agencies(state);

CREATE INDEX IF NOT EXISTS idx_master_clients_contact_email ON master_clients(contact_email);
CREATE INDEX IF NOT EXISTS idx_master_clients_contact_phone ON master_clients(contact_phone);
CREATE INDEX IF NOT EXISTS idx_master_clients_city ON master_clients(city);
CREATE INDEX IF NOT EXISTS idx_master_clients_state ON master_clients(state);
CREATE INDEX IF NOT EXISTS idx_master_clients_client_type ON master_clients(client_type);

-- Update RLS policies to include new fields
-- Agencies policies remain the same as they use get_user_claims()
-- Clients policies remain the same as they use get_user_claims() 