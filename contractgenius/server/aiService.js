/**
 * AI SERVICE
 * Uses Groq to analyze inventory trends and generate proactive stock alerts.
 */

const { Groq } = require('groq-sdk');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

/**
 * Analyzes inventory levels and returns a human-readable recommendation if stock is low.
 * @param {string} fixtureName 
 * @param {number} available 
 * @param {number} total 
 */
async function analyzeInventoryRisk(fixtureName, available, total) {
    if (!groq) {
        return `Inventory for ${fixtureName} is low (${available}/${total}). Please restock soon.`;
    }

    try {
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are an inventory monitoring agent for a high-end trade show (CABANA). Your job is to alert the logistics team when fixtures are running low. Provide a short, urgent, but professional warning including a recommendation (e.g., stop bookings, swap for another fixture, or rush restock).'
                },
                {
                    role: 'user',
                    content: `Fixture: ${fixtureName}. Current Available: ${available}. Total Stock: ${total}. Calculate the risk and give a one-sentence recommendation.`
                }
            ],
            model: 'mixtral-8x7b-32768',
            max_tokens: 100
        });

        return response.choices[0]?.message?.content || `Critical low stock for ${fixtureName}.`;
    } catch (e) {
        console.error('[AIService] Groq failed:', e.message);
        return `Urgent: ${fixtureName} availability is at ${available}/${total}. Recommend immediate review.`;
    }
}

module.exports = { analyzeInventoryRisk };
