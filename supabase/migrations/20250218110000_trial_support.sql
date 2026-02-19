-- Migration: Trial Support
-- Description: Modifies subscriptions table to allow nullable fields for trial support and adds access status function.

-- 1. Modify subscriptions table to allow nullable fields
ALTER TABLE public.subscriptions ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN cycle DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN billing_type DROP NOT NULL;

-- 2. Create function to check company access status
CREATE OR REPLACE FUNCTION public.company_access_status(check_company_id uuid)
RETURNS TABLE (
  can_access boolean,
  reason text
) AS $$
DECLARE
    sub public.subscriptions%ROWTYPE;
BEGIN
    -- Get the active or most relevant subscription
    SELECT * INTO sub
    FROM public.subscriptions
    WHERE company_id = check_company_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- No subscription found
    IF sub IS NULL THEN
        RETURN QUERY SELECT false, 'no_subscription';
        RETURN;
    END IF;

    -- Check status
    IF sub.status = 'trialing' THEN
        IF sub.trial_ends_at > NOW() THEN
            RETURN QUERY SELECT true, 'trialing';
        ELSE
            RETURN QUERY SELECT false, 'trial_expired';
        END IF;
        RETURN;
    END IF;

    IF sub.status = 'active' THEN
        RETURN QUERY SELECT true, 'active';
        RETURN;
    END IF;
    
    IF sub.status = 'overdue' THEN
         -- Optionally allow grace period logic here if needed, for now block
        RETURN QUERY SELECT false, 'overdue';
        RETURN;
    END IF;

    IF sub.status = 'canceled' THEN
         -- Check if still within access period
         IF sub.access_until > NOW() THEN
             RETURN QUERY SELECT true, 'canceled_but_access_valid';
         ELSE
             RETURN QUERY SELECT false, 'canceled';
         END IF;
         RETURN;
    END IF;
    
    RETURN QUERY SELECT false, sub.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
