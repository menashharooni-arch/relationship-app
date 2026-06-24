-- Add logo and label to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS label text;

-- Add follow_up_sequence to leads (if not exists)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_sequence jsonb DEFAULT '[]'::jsonb;
