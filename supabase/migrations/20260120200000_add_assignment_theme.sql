-- Migration: Add Theme and Support Texts to Assignments
-- Description: Extends assignments table to support AI-generated themes and base texts

-- Add theme and support_texts columns to assignments table
DO $$
BEGIN
    -- Add theme column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignments' AND column_name = 'theme'
    ) THEN
        ALTER TABLE public.assignments ADD COLUMN theme text;
    END IF;

    -- Add support_texts column if it doesn't exist
    -- Format: [{"id": "1", "title": "Texto 1", "content": "...", "icon": "article"}]
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignments' AND column_name = 'support_texts'
    ) THEN
        ALTER TABLE public.assignments ADD COLUMN support_texts jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.assignments.theme IS 'AI-generated or custom theme title for the assignment';
COMMENT ON COLUMN public.assignments.support_texts IS 'Array of support texts in format: [{"id", "title", "content", "icon"}]';
