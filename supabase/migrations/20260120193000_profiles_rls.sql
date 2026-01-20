-- Migration: Fix Profiles RLS and Columns
-- Description: Ensures 'school' or 'school_name' exists and allows users to update their own profile.

-- 1. Ensure 'school' column exists (legacy field, keeping for compatibility if used)
-- Note: schema has 'school_id', but frontend sends 'school_name'. Let's ensure it exists.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'school_name') THEN
        ALTER TABLE public.profiles ADD COLUMN school_name text;
    END IF;
END $$;

-- 2. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create/Reset Policies for Profiles

-- Policy: Users can view their own profile (and maybe others? For now, public read is common for profiles)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Policy: Users can insert their own profile (usually handled by triggers, but good for manual insert)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);
