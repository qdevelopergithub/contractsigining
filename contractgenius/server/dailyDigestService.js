/**
 * DAILY DIGEST SERVICE
 * Periodically updates the Dashboard tab in Google Sheets
 * and sends a summary email digest to the admin team.
 */

const cron = require('node-cron');
const sheetsService = require('./sheetsService');
const emailService = require('./emailService');

/**
 * Main digest task logic
 */
async function runDailyDigest() {
    console.log('[DailyDigest] 🕒 Starting daily summary task...');
    
    try {
        // 1. Ensure Dashboard is initialized and formulas are fresh
        await sheetsService.initializeDashboard();
        
        // 2. Small delay to allow Google Sheets to calculate formulas if needed
        // (Though usually reading the results of formulas is fine immediately)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. Fetch the latest metrics from the Dashboard tab
        const metrics = await sheetsService.getDashboardMetrics();
        
        if (metrics) {
            console.log(`[DailyDigest] Metrics retrieved: Signed=${metrics.sales.signed}, Collected=${metrics.payments.totalCollected}`);
            
            // 4. Trigger Make.com Webhook for Daily Digest
            const MAKE_DIGEST_URL = process.env.MAKE_DIGEST_WEBHOOK_URL || "https://hook.us2.make.com/your_digest_webhook_here";
            
            await fetch(MAKE_DIGEST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: "daily_summary_digest",
                    date: new Date().toLocaleDateString(),
                    metrics: {
                        total_contracts: metrics.sales.total,
                        signed_contracts: metrics.sales.signed,
                        draft_contracts: metrics.sales.draft,
                        total_billed: metrics.payments.totalBilled,
                        total_collected: metrics.payments.totalCollected,
                        balance_due: metrics.payments.balanceDue
                    },
                    dashboard_url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}`
                })
            });

            console.log('[DailyDigest] ✅ Daily summary data sent to Make.com.');
        } else {
            console.warn('[DailyDigest] ⚠️ Could not retrieve metrics from Dashboard.');
        }

    } catch (error) {
        console.error('[DailyDigest] ❌ Failed during daily digest task:', error.message);
    }
}

/**
 * Initializes the daily digest schedule
 * Default: Runs everyday at 9:00 AM
 */
function initDailyDigest() {
    // Schedule: Seconds(opt) Minutes Hours DayOfMonth Month DayOfWeek
    // '0 0 9 * * *' -> Every day at 9 AM
    const schedule = process.env.DIGEST_SCHEDULE || '0 0 9 * * *';
    
    cron.schedule(schedule, () => {
        runDailyDigest();
    });

    console.log(`[DailyDigest] 🔋 Daily Summary Digest scheduled: ${schedule}`);
    
    // Optional: Run once on startup to ensure Dashboard tab exists
    sheetsService.initializeDashboard().catch(e => 
        console.error('[DailyDigest] Failed to initialize dashboard on startup:', e.message)
    );
}

module.exports = { initDailyDigest, runDailyDigest };
