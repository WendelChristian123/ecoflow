-- Enable RLS on saas_plans (already enabled, but good practice to ensure)
ALTER TABLE saas_plans ENABLE ROW LEVEL SECURITY;

-- Allow Super Admins to INSERT
CREATE POLICY "Super Admins can insert plans" ON saas_plans
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'super_admin'
  )
);

-- Allow Super Admins to UPDATE
CREATE POLICY "Super Admins can update plans" ON saas_plans
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'super_admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'super_admin'
  )
);

-- Allow Super Admins to DELETE
CREATE POLICY "Super Admins can delete plans" ON saas_plans
FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'super_admin'
  )
);
