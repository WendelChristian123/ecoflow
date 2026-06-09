
-- Fix trigger events_sync_notification error on jsonb array loop

CREATE OR REPLACE FUNCTION public.trg_events_sync_notification()
RETURNS TRIGGER AS $$$
DECLARE
    participant_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        IF OLD.participants IS NOT NULL AND jsonb_typeof(OLD.participants) = 'array' THEN
            FOR participant_id IN SELECT value::UUID FROM jsonb_array_elements_text(OLD.participants) LOOP
                PERFORM public.fn_sync_scheduled_notification(OLD.company_id, participant_id, OLD.id, 'event_start', 'routines', OLD.start_date, FALSE);
            END LOOP;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.participants IS NOT NULL AND NEW.start_date IS NOT NULL AND jsonb_typeof(NEW.participants) = 'array' THEN
        FOR participant_id IN SELECT value::UUID FROM jsonb_array_elements_text(NEW.participants) LOOP
            PERFORM public.fn_sync_scheduled_notification(
                NEW.company_id, 
                participant_id, 
                NEW.id, 
                'event_start', 
                'routines', 
                NEW.start_date, 
                NEW.status NOT IN ('completed', 'cancelled')
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$$ LANGUAGE plpgsql;
