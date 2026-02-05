import { supabase } from './supabase';

export const commercialLogic = {
    /**
     * Checks for quotes that have passed their validUntil date and moves them to the 'Vencidos' stage.
     * This simulates a backend job by running on client-side mount (lazy check).
     */
    checkAndEnforceQuoteExpiration: async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Fetch expired quotes that are not already in a "finished" state (won/lost) or already expired
            // "Active" quotes are those NOT in 'approved', 'rejected', 'expired' statuses.
            // But we specifically want to find ones where due date < today.

            const { data: expiredQuotes, error } = await supabase
                .from('quotes')
                .select('id, kanban_id, status, valid_until')
                .lt('valid_until', today)
                .not('status', 'in', '("approved","rejected","expired")');

            if (error) {
                console.error('Error checking for expired quotes:', error);
                return;
            }

            if (!expiredQuotes || expiredQuotes.length === 0) return;

            console.log(`Found ${expiredQuotes.length} expired quotes. Processing...`);

            // Group by Kanban ID to find the correct "Vencidos" stage for each board
            const kanbanIds = [...new Set(expiredQuotes.map(q => q.kanban_id).filter(Boolean))];

            for (const kId of kanbanIds) {
                // Find the "Vencidos" stage for this Kanban
                // We rely on system_status = 'expired' OR name = 'Vencidos' as fallback
                const { data: expiredStage } = await supabase
                    .from('kanban_stages')
                    .select('id')
                    .eq('kanban_id', kId)
                    .or('system_status.eq.expired,name.eq.Vencidos')
                    .single();

                if (expiredStage) {
                    // Bulk update quotes for this Kanban
                    const quotesToUpdate = expiredQuotes
                        .filter(q => q.kanban_id === kId)
                        .map(q => q.id);

                    if (quotesToUpdate.length > 0) {
                        await supabase
                            .from('quotes')
                            .update({
                                status: 'expired',
                                kanban_stage_id: expiredStage.id
                            })
                            .in('id', quotesToUpdate);

                        console.log(`Updated ${quotesToUpdate.length} quotes to Expired in Kanban ${kId}`);
                    }
                }
            }

        } catch (err) {
            console.error('Unexpected error in checkAndEnforceQuoteExpiration:', err);
        }
    }
};
