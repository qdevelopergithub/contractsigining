/**
 * EMAIL SERVICE
 * Sends automated notifications to the admin team using Nodemailer.
 * Handles: contract signed alerts, low stock alerts, and payment confirmations.
 * Requires EMAIL_USER, EMAIL_PASSWORD, and ALERT_EMAIL in .env
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const ALERT_EMAIL = process.env.ALERT_EMAIL || process.env.EMAIL_USER;

/**
 * Sends a notification when a vendor signs a contract
 * @param {Object} contract - The signed contract object
 */
async function sendContractSignedAlert(contract) {
    if (!process.env.EMAIL_USER) return;

    const vendor = contract.vendorDetails || contract.vendor;
    const vendorName = vendor?.contacts?.[0]?.name || vendor?.name || 'Unknown Vendor';
    const company = vendor?.company || 'Unknown Company';

    const mailOptions = {
        from: `"Contract Genius" <${process.env.EMAIL_USER}>`,
        to: ALERT_EMAIL,
        subject: `✅ New Contract Signed: ${company}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #4f46e5; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0;">Contract Signed 🎉</h2>
                </div>
                <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p><strong>Contract ID:</strong> ${contract.id}</p>
                    <p><strong>Company:</strong> ${company}</p>
                    <p><strong>Contact:</strong> ${vendorName}</p>
                    <p><strong>Email:</strong> ${vendor?.contacts?.[0]?.email || vendor?.email || 'N/A'}</p>
                    <p><strong>Booth Size:</strong> ${vendor?.finalBoothSize || vendor?.boothSize || 'N/A'}</p>
                    <p><strong>Total Amount:</strong> $${vendor?.totalAmount || 0}</p>
                    <p><strong>Status:</strong> <span style="color: #f59e0b; font-weight: bold;">${contract.status?.toUpperCase()}</span></p>
                    <hr style="border: 1px solid #e5e7eb; margin: 15px 0;">
                    <p style="color: #6b7280; font-size: 12px;">This is an automated alert from Contract Genius.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] ✅ Contract signed alert sent for ${contract.id}`);
    } catch (error) {
        console.error('[EmailService] Failed to send contract signed alert:', error.message);
    }
}

/**
 * Sends a low stock warning to the admin team
 * @param {string} fixtureName - Name of the fixture low on stock
 * @param {number} available - Remaining available stock
 * @param {number} total - Total stock for this fixture
 */
async function sendLowStockAlert(fixtureName, available, total) {
    if (!process.env.EMAIL_USER) return;

    const mailOptions = {
        from: `"Contract Genius" <${process.env.EMAIL_USER}>`,
        to: ALERT_EMAIL,
        subject: `⚠️ Low Stock Alert: ${fixtureName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #dc2626; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0;">⚠️ Low Stock Warning</h2>
                </div>
                <div style="background: #fef2f2; padding: 20px; border: 1px solid #fecaca; border-radius: 0 0 8px 8px;">
                    <p><strong>Fixture:</strong> ${fixtureName}</p>
                    <p><strong>Available:</strong> <span style="color: #dc2626; font-weight: bold;">${available} remaining</span></p>
                    <p><strong>Total Stock:</strong> ${total}</p>
                    <p style="background: #fee2e2; padding: 10px; border-radius: 4px; margin-top: 15px;">
                        Action Required: Please review inventory levels and consider removing this fixture from active booking options.
                    </p>
                    <hr style="border: 1px solid #fecaca; margin: 15px 0;">
                    <p style="color: #6b7280; font-size: 12px;">This is an automated alert from Contract Genius Inventory System.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] ✅ Low stock alert sent for ${fixtureName}`);
    } catch (error) {
        console.error('[EmailService] Failed to send low stock alert:', error.message);
    }
}

/**
 * Sends a payment confirmation alert to the admin team
 * @param {string} contractId 
 * @param {string} company 
 * @param {number} amount 
 */
async function sendPaymentConfirmedAlert(contractId, company, amount) {
    if (!process.env.EMAIL_USER) return;

    const mailOptions = {
        from: `"Contract Genius" <${process.env.EMAIL_USER}>`,
        to: ALERT_EMAIL,
        subject: `💳 Payment Received: ${company}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <div style="background: #16a34a; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0;">💳 Payment Confirmed</h2>
                </div>
                <div style="background: #f0fdf4; padding: 20px; border: 1px solid #bbf7d0; border-radius: 0 0 8px 8px;">
                    <p><strong>Contract ID:</strong> ${contractId}</p>
                    <p><strong>Company:</strong> ${company}</p>
                    <p><strong>Amount Paid:</strong> <span style="color: #16a34a; font-weight: bold;">$${amount}</span></p>
                    <p>Payment status has been updated to <strong>PAID</strong> in the Google Sheet.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] ✅ Payment confirmation sent for ${contractId}`);
    } catch (error) {
        console.error('[EmailService] Failed to send payment alert:', error.message);
    }
}

/**
 * Sends a friendly reminder to a vendor to sign their contract
 * @param {Object} contractData - Brief contract info
 */
async function sendReminderEmail(contract) {
    if (!process.env.EMAIL_USER) return;

    const vendor = contract.vendorDetails || contract.vendor;
    const company = vendor?.company || 'Vendor';
    const email = vendor?.contacts?.[0]?.email || vendor?.email;
    const magicLink = contract.magicLink || `${process.env.SIGNING_APP_URL}/#/contract/${contract.id}`;

    if (!email) return;

    const mailOptions = {
        from: `"Contract Genius" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🔔 Friendly Reminder: Contract Signature Needed for ${company}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
                <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-radius: 12px; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #111827; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Signature Required</h2>
                    <p style="font-size: 16px; line-height: 24px;">Hi ${company},</p>
                    <p style="font-size: 16px; line-height: 24px;">This is a friendly reminder that your exhibit service agreement for <strong>${company}</strong> is pending signature.</p>
                    <p style="font-size: 16px; line-height: 24px;">To secure your booth and fixture selection, please review and sign the document using the secure link below:</p>
                    
                    <div style="margin: 32px 0;">
                        <a href="${magicLink}" style="background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Review & Sign Contract</a>
                    </div>

                    <p style="font-size: 14px; color: #6b7280;">If you have already signed or have questions, please ignore this email or contact us directly.</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                    <p style="font-size: 12px; color: #9ca3af;">Securely sent by Contract Genius</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] 🔔 Reminder sent to ${company} (${email}) for ${contract.id}`);
    } catch (error) {
        console.error('[EmailService] Failed to send reminder email:', error.message);
    }
}

module.exports = { 
    sendContractSignedAlert, 
    sendLowStockAlert, 
    sendPaymentConfirmedAlert,
    sendReminderEmail
};
