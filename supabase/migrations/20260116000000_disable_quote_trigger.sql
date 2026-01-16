-- DURATION: < 1s
-- DESCRIPTION: Drops the legacy trigger that automatically creates financial transactions on quote approval.
-- This logic is now handled in the frontend (QuoteApprovalModal) to allow user choice (Contract vs One-time).

DROP TRIGGER IF EXISTS on_quote_approve ON public.quotes;
DROP FUNCTION IF EXISTS public.handle_quote_approval();
