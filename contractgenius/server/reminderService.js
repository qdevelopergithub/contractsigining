/**
 * REMINDER SERVICE
 * Periodically scans Google Sheets for unsigned contracts ('draft' status)
 * and sends reminder emails to vendors.
 */

const cron = require('node-cron');
const sheetsService = require('./sheetsService');
const emailService = require('./emailService');

/**
 * Main reminder task logic
 */
async function runReminderTask() {
    console.log('[ReminderService] 🕒 Starting automated reminder scan...');
    
    try {
        const rows = await sheetsService.getAllRows();
        const now = new Date();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        
        // Filter criteria:
        // 1. Status is 'draft' (Column L / Index 11)
        // 2. Created more than 24 hours ago (Column A / Index 0)
        const pendingReminders = rows.filter(row => {
            const status = row[11]?.toLowerCase();
            const createdAt = new Date(row[0]);
            
            if (status !== 'draft') return false;
            
            const ageInMs = now - createdAt;
            return ageInMs > ONE_DAY_MS;
        });

        console.log(`[ReminderService] Found ${pendingReminders.length} contracts requiring reminders.`);

        for (const row of pendingReminders) {
            const contractId = row[1];
            // Fetch full contract object to get the most accurate email/details
            const contract = await sheetsService.getContractById(contractId);
            
            if (contract && contract.status === 'draft') {
                await emailService.sendReminderEmail(contract);
                // Optional: We could update a column in Sheets to track how many reminders were sent
            }
        }

        console.log('[ReminderService] ✅ Reminder scan completed.');
    } catch (error) {
        console.error('[ReminderService] ❌ Failed during reminder scan:', error.message);
    }
}

/**
 * Initializes the reminder schedule
 * Default: Runs everyday at 9:00 AM
 */
function initReminders() {
    // Schedule: Seconds(opt) Minutes Hours DayOfMonth Month DayOfWeek
    // '0 0 9 * * *' -> Every day at 9 AM
    // For testing/development, you can use '*/5 * * * *' (Every 5 minutes)
    const schedule = process.env.REMINDER_SCHEDULE || '0 0 9 * * *';
    
    cron.schedule(schedule, () => {
        runReminderTask();
    });

    console.log(`[ReminderService] 🔋 Automated reminders scheduled: ${schedule}`);
    
    // Optional: Run once on startup if needed
    // runReminderTask();
}

module.exports = { initReminders, runReminderTask };
