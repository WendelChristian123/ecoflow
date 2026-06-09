-- Fix calendar_events trigger for jsonb participants
CREATE OR REPLACE FUNCTION public.trg_events_sync_notification()
RETURNS TRIGGER AS $$
DECLARE
    participant_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        IF OLD.participants IS NOT NULL THEN
            FOR participant_id IN SELECT jsonb_array_elements_text(OLD.participants)::UUID LOOP
                PERFORM public.fn_sync_scheduled_notification(OLD.company_id, participant_id, OLD.id, 'event_start', 'routines', OLD.start_date, FALSE);
            END LOOP;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.participants IS NOT NULL AND NEW.start_date IS NOT NULL THEN
        FOR participant_id IN SELECT jsonb_array_elements_text(NEW.participants)::UUID LOOP
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
$$ LANGUAGE plpgsql;
