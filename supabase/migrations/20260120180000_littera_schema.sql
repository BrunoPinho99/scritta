-- Migration: Littera Schema Transformation
-- Description: Adds tables for Schools, Classes, Assignments and ensures relationships.

-- 1. SCHOOLS
CREATE TABLE IF NOT EXISTS public.schools (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name text NOT NULL,
    grade text,
    shift text,
    created_at timestamptz DEFAULT now()
);

-- 3. UPDATING PROFILES
-- Ensure profiles has school_id link
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'school_id') THEN
        ALTER TABLE public.profiles ADD COLUMN school_id uuid REFERENCES public.schools(id);
    END IF;
END $$;

-- 4. CLASS MEMBERS (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.class_members (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('student', 'teacher')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(class_id, user_id)
);

-- 5. ASSIGNMENTS (Tarefas)
CREATE TABLE IF NOT EXISTS public.assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    due_date timestamptz,
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now()
);

-- 6. LINK ESSAYS TO ASSIGNMENTS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'essays' AND column_name = 'assignment_id') THEN
        ALTER TABLE public.essays ADD COLUMN assignment_id uuid REFERENCES public.assignments(id);
    END IF;
END $$;

-- 7. ENABLE RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- 8. BASIC RLS POLICIES (Permissive for now for development, refine later)

-- Schools: Viewable by everyone (for lookup), editable by admins (TODO)
DROP POLICY IF EXISTS "Schools are viewable by everyone" ON public.schools;
CREATE POLICY "Schools are viewable by everyone" ON public.schools FOR SELECT USING (true);

-- Classes: Viewable by authenticated users
DROP POLICY IF EXISTS "Classes viewable by auth" ON public.classes;
CREATE POLICY "Classes viewable by auth" ON public.classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Classes editable by auth" ON public.classes;
CREATE POLICY "Classes editable by auth" ON public.classes FOR ALL TO authenticated USING (true); -- TODO: Lock down to School Admins

-- Assignments: View/Edit by auth (TODO: Lock down)
DROP POLICY IF EXISTS "Assignments generic" ON public.assignments;
CREATE POLICY "Assignments generic" ON public.assignments FOR ALL TO authenticated USING (true);

-- Class Members: View/Edit by auth
DROP POLICY IF EXISTS "ClassMembers generic" ON public.class_members;
CREATE POLICY "ClassMembers generic" ON public.class_members FOR ALL TO authenticated USING (true);
