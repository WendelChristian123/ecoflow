-- Migration for System Notifications and Preferences
-- Creates tables for storing user notification preferences and persistent system notifications (for screen blocking)

-- 1. System Notifications Table
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,
    reference_type TEXT, -- 'task', 'event', etc.
    requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    is_acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users view own notifications" 
ON public.system_notifications FOR SELECT 
USING (user_id = auth.uid() AND company_id = get_current_company_id());

-- Users can update (acknowledge) their own notifications
CREATE POLICY "Users update own notifications" 
ON public.system_notifications FOR UPDATE 
USING (user_id = auth.uid() AND company_id = get_current_company_id());

-- Any user in the tenant can insert a notification (e.g. assigning a task to someone else)
CREATE POLICY "Users insert tenant notifications" 
ON public.system_notifications FOR INSERT 
WITH CHECK (company_id = get_current_company_id());


-- 2. User Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL REFERENCES public.app_modules(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    notify_before_minutes INTEGER NOT NULL,
    UNIQUE(company_id, user_id, module_id, event_type)
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users manage own notification preferences" 
ON public.user_notification_preferences FOR ALL 
USING (user_id = auth.uid() AND company_id = get_current_company_id());

-- Admins can also manage it if needed, but for now user scope is enough.
