const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const fs = require('fs');
const path = require('path');

// QB base URLs — driven by env so switching sandbox↔production requires no code change
const isSandbox = (process.env.QB_ENVIRONMENT || 'sandbox') === 'sandbox';
const QB_API_BASE = isSandbox
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';

const TOKEN_FILE = path.join(__dirname, 'qb_oauth_token.json');

let oauthClient = new OAuthClient({
  clientId: process.env.QB_CLIENT_ID,
  clientSecret: process.env.QB_CLIENT_SECRET,
  environment: process.env.QB_ENVIRONMENT || 'sandbox',
  redirectUri: process.env.QB_REDIRECT_URI || 'http://localhost:3001/auth/callback',
});

let oauthToken = null;

const loadToken = () => {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      oauthToken = JSON.parse(data);
      console.log('[QB] Loaded stored OAuth token');
    }
  } catch (e) {
    console.error('[QB] Error loading token:', e.message);
  }
};

const saveToken = (token) => {
  try {
    oauthToken = token;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
  } catch (e) {
    console.error('[QB] Error saving token:', e.message);
  }
};

loadToken();

const getAuthUri = () => {
  return oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'Init',
  });
};

const createToken = async (url) => {
  try {
    const authResponse = await oauthClient.createToken(url);
    const token = authResponse.getJson();
    saveToken(token);
    return token;
  } catch (e) {
    console.error('Error creating QB token:', e);
    throw e;
  }
};

// Calls QB OAuth endpoint directly to refresh using refresh_token
const forceRefreshToken = async () => {
  if (!oauthToken?.refresh_token) {
    throw new Error('[QB] No refresh_token available. Re-authentication required.');
  }
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: oauthToken.refresh_token,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[QB] Token refresh failed (${response.status}): ${err}`);
  }

  const newTokenData = await response.json();

  // QB returns expires_in in seconds — store created_at for expiry calculation
  const updatedToken = {
    ...oauthToken,
    access_token: newTokenData.access_token,
    refresh_token: newTokenData.refresh_token || oauthToken.refresh_token,
    expires_in: newTokenData.expires_in,
    x_refresh_token_expires_in: newTokenData.x_refresh_token_expires_in,
    created_at: Math.floor(Date.now() / 1000),
  };

  saveToken(updatedToken);
  console.log('[QB] ✅ Access token refreshed successfully');
  return updatedToken;
};

const isTokenExpired = () => {
  if (!oauthToken?.created_at || !oauthToken?.expires_in) return true;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = oauthToken.created_at + oauthToken.expires_in;
  return now >= expiresAt - 300; // refresh 5 min before expiry
};

const refreshTokenIfNeeded = async () => {
  if (!oauthToken) throw new Error('[QB] Not authenticated. No token found.');

  if (isTokenExpired()) {
    await forceRefreshToken();
  }
};

const buildQbClient = () => new QuickBooks(
  process.env.QB_CLIENT_ID,
  process.env.QB_CLIENT_SECRET,
  oauthToken.access_token,
  false,
  process.env.QB_COMPANY_ID,
  process.env.QB_ENVIRONMENT === 'sandbox',
  true,
  null,
  '2.0',
  oauthToken.refresh_token
);

const getQbClient = async () => {
  if (!oauthToken) throw new Error('[QB] Not authenticated.');
  await refreshTokenIfNeeded();
  return buildQbClient();
};

// Wraps a QB API call — auto-refreshes and retries once on 401
const withAutoRefresh = async (apiFn) => {
  try {
    const qbo = await getQbClient();
    return await apiFn(qbo);
  } catch (e) {
    const is401 = e?.message?.includes('401') ||
      e?.intuit_tid ||
      e?.error === 'invalid_token' ||
      (e?.response?.statusCode === 401);

    if (is401) {
      console.warn('[QB] 401 detected — forcing token refresh and retrying...');
      await forceRefreshToken();
      const qbo = buildQbClient();
      return await apiFn(qbo);
    }
    throw e;
  }
};

const createCustomer = (qbo, vendorData) => {
  return new Promise((resolve, reject) => {
    // Handle both `company` and `companyName` field names
    const companyName = vendorData.company || vendorData.companyName || 'Cabana Vendor';
    const contactName = vendorData.contacts?.[0]?.name || vendorData.name || '';
    const phone = vendorData.contacts?.[0]?.phone || vendorData.phone || '';
    const email = vendorData.contacts?.[0]?.email || vendorData.email || '';

    // QB requires DisplayName to be unique — use company + contact if available
    const displayName = contactName ? `${contactName} (${companyName})` : companyName;

    const customer = {
      DisplayName: displayName,
      CompanyName: companyName,
      GivenName: contactName.split(' ')[0] || '',
      FamilyName: contactName.split(' ').slice(1).join(' ') || '',
      PrimaryEmailAddr: email ? { Address: email } : undefined,
      PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
      BillAddr: vendorData.address ? {
        Line1: vendorData.address,
        City: vendorData.city || '',
        CountrySubDivisionCode: vendorData.state || '',
        PostalCode: vendorData.zip || '',
        Country: 'USA'
      } : undefined
    };

    qbo.findCustomers({
      DisplayName: displayName
    }, (err, customers) => {
      if (err) {
        console.error("Error finding customer:", err);
        return reject(err);
      }

      if (customers && customers.QueryResponse && customers.QueryResponse.Customer && customers.QueryResponse.Customer.length > 0) {
        console.log(`[QB] Found existing customer: ${displayName} (ID: ${customers.QueryResponse.Customer[0].Id})`);
        return resolve(customers.QueryResponse.Customer[0]);
      }

      qbo.createCustomer(customer, (err, newCustomer) => {
        if (err) {
          console.error("Error creating customer:", err);
          return reject(err);
        }
        console.log(`[QB] Created new customer: ${displayName} (ID: ${newCustomer.Id})`);
        resolve(newCustomer);
      });
    });
  });
};

const createInvoice = (qbo, customerId, contractData) => {
  return new Promise((resolve, reject) => {
    const v = contractData.vendorDetails || contractData.vendor;
    const companyName = v.company || v.companyName || 'Vendor';
    const boothSize = v.finalBoothSize || v.boothSize || 'Standard Booth';
    const fixtures = (v.selectedFixtures || []).map(f => `${f.type} x${f.quantity}`).join(', ') || 'N/A';
    const categories = (v.categories || []).join(', ') || 'N/A';
    const brands = (v.brands || []).filter(b => b.brandName).map(b => b.brandName).join(', ') || companyName;
    const eventDates = Array.isArray(v.eventDates) ? v.eventDates.join(', ') : (v.eventDate || 'TBD');
    const paymentMode = v.paymentMode || 'Credit Card';
    const notes = v.notes || '';

    // Fixtures summary for descriptions (no separate $0 line items — QB rejects Amount/UnitPrice mismatch)
    const fixtureLines = (v.selectedFixtures || []).map(f => `${f.type} (Qty: ${f.quantity})`).join(', ') || 'N/A';
    const customerEmail =
      v.contacts?.[0]?.email ||
      v.email ||
      "";
    const lines = [];
    if (!customerEmail) {
      return reject(new Error("Customer email is required for invoice"));
    }
    // 1. Booth reservation — fixtures included in description (minimum $1 by default)
    const boothAmount = v.baseAmount || v.totalAmount || 1;
    if (boothAmount > 0) {
      lines.push({
        Amount: boothAmount,
        DetailType: "SalesItemLineDetail",
        Description: [
          `Exhibitor Booth: ${boothSize}`,
          `Fixtures: ${fixtureLines}`,
          `Categories: ${categories}`,
          `Brands: ${brands}`,
          `Event Date(s): ${eventDates}`,
        ].join(' | '),
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: boothAmount,  // Amount must equal UnitPrice * Qty
          Qty: 1
        }
      });
    }

    // 2. Deposit line (if applicable)
    if (v.depositAmount > 0) {
      lines.push({
        Amount: v.depositAmount,
        DetailType: "SalesItemLineDetail",
        Description: `Booth Deposit - ${boothSize}`,
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: v.depositAmount,
          Qty: 1
        }
      });
    }

    // 3. CC fee line — Amount must equal UnitPrice * Qty
    if (v.ccFee > 0) {
      lines.push({
        Amount: v.ccFee,
        DetailType: "SalesItemLineDetail",
        Description: `Credit Card Processing Fee (2.99%) — Payment Method: ${paymentMode}`,
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: v.ccFee,
          Qty: 1
        }
      });
    }

    // 4. Fallback: $1 placeholder if no amounts set
    if (lines.length === 0) {
      lines.push({
        Amount: 1.00,
        DetailType: "SalesItemLineDetail",
        Description: `Exhibitor Booth Reservation — ${companyName} | Booth: ${boothSize} | Fixtures: ${fixtureLines} | Categories: ${categories} | Event: ${eventDates} (amount to be updated)`,
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: 1.00,
          Qty: 1
        }
      });
    }

    // Build memo with all contract details
    const memo = [
      `Contract ID: ${contractData.id}`,
      `Exhibitor Type: ${v.exhibitorType || 'N/A'}`,
      `Company: ${companyName}`,
      `Contact: ${v.contacts?.[0]?.name || v.name || 'N/A'} | ${v.contacts?.[0]?.email || v.email || 'N/A'} | ${v.contacts?.[0]?.phone || v.phone || 'N/A'}`,
      `Brands: ${brands}`,
      `Booth: ${boothSize}`,
      `Fixtures: ${fixtures}`,
      `Categories: ${categories}`,
      `Event Date(s): ${eventDates}`,
      `Payment Mode: ${paymentMode}`,
      notes ? `Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    const invoiceParams = {
      CustomerRef: { value: customerId },
      CustomerMemo: { value: memo },
      Line: lines,
      BillEmail: {
        Address: customerEmail
      },

      AllowOnlinePayment: true,
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment: true
    };
    qbo.createInvoice(invoiceParams, (err, invoice) => {
      if (err) {
        console.error("[QB] Error creating invoice:", err);
        return reject(err);
      }
      console.log(`[QB] Invoice created successfully! Invoice ID: ${invoice.Id}`);
      resolve(invoice);
    });
  });
};

const processContractSignatureForQB = async (contractData) => {
  try {
    if (!oauthToken) {
      console.log("[QB] Skipping - Not authenticated");
      return null;
    }

    const vendorData = contractData.vendorDetails || contractData.vendor;

    if (!vendorData || !vendorData.email) {
      console.log("[QB] Skipping - No vendor data or email");
      return null;
    }

    console.log(`[QB] Processing contract for: ${vendorData.company || vendorData.name}`);

    const customer = await withAutoRefresh((qbo) =>
      createCustomer(qbo, vendorData)
    );

    const invoice = await withAutoRefresh((qbo) =>
      createInvoice(qbo, customer.Id, contractData)
    );

    if (!invoice) return null;

    console.log(`[QB] ✅ Invoice ${invoice.Id} created`);

    const customerEmail =
      vendorData.contacts?.[0]?.email || vendorData.email;

    if (!customerEmail) {
      console.log("[QB] ❌ No email found");
      return invoice;
    }

    await fetch(
      `${QB_API_BASE}/v3/company/${oauthClient.realmId}/invoice/${invoice.Id}/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oauthToken.access_token}`,
          Accept: "application/json",
        },
      }
    );

    await new Promise((r) => setTimeout(r, 2000));

    const refreshedInvoice = await withAutoRefresh((qbo) =>
      new Promise((resolve, reject) => {
        qbo.getInvoice(invoice.Id, (err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      })
    );
    const submissionLink = refreshedInvoice.InvoiceLink;

    if (!submissionLink) {
      console.error("[QB] ❌ InvoiceLink not found");
      return invoice;
    }

    console.log("[QB] 💳 Payment Link:", submissionLink);

    // 🔥 STEP 5: SEND TO MAKE WEBHOOK
    const makeWebhookUrl = process.env.PAYMENT_INVOICE || 'https://hook.us2.make.com/ggaajop3yqmam0e6dk7j247oxiu1eueh';

    await fetch(makeWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: 'invoice_payment',
         email: customerEmail, 
         to: customerEmail, 
         submissionLink: submissionLink, 
         invoiceId: invoice.Id, 
         companyName: vendorData.company || '',
      }),
    });
console.log("vendor details",vendorData)
    console.log("[QB] ✅ Webhook sent successfully");

    return invoice;
  } catch (e) {
    console.error("[QB] ❌ Integration Failed:", e.message);
    return null;
  }
};

const isAuthenticated = () => {
  return oauthToken !== null;
};

const getTokenStatus = () => {
  if (!oauthToken) return { authenticated: false };

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = oauthToken.created_at + oauthToken.expires_in;
  const isExpiringSoon = expiresAt && now >= expiresAt - 300;

  return {
    authenticated: true,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    isExpiringSoon
  };
};

/**
 * Sends the QB invoice email to the customer.
 * Uses QB REST API: POST /v3/company/{realmId}/invoice/{invoiceId}/send
 * @param {string} invoiceId - QB Invoice ID (e.g. "32545")
 * @param {string} toEmail   - Customer email address
 */
const sendInvoiceEmail = async (invoiceId, toEmail) => {
  if (!oauthToken?.access_token) {
    throw new Error('[QB] Not authenticated — cannot send invoice email.');
  }

  const realmId = process.env.QB_COMPANY_ID;
  const url = `${QB_API_BASE}/v3/company/${realmId}/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(toEmail)}`;

  console.log(`[QB] Sending invoice ${invoiceId} to ${toEmail}...`);

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${oauthToken.access_token}`,
      'Content-Type': 'application/octet-stream',
      'Accept': 'application/json',
    },
  });

  // Auto-refresh on 401 and retry once
  if (response.status === 401) {
    console.warn('[QB] 401 on invoice send — refreshing token and retrying...');
    await forceRefreshToken();
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken.access_token}`,
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/json',
      },
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[QB] Failed to send invoice email (${response.status}): ${errText}`);
  }
  console.log("Email Responce....", response);

  const data = await response.json();
  console.log(`[QB] ✅ Invoice email sent to ${toEmail} for invoice ${invoiceId}`);
  return data;
};

/**
 * Called when QB fires a Payment webhook.
 * Looks up the payment → finds the linked invoice → extracts Contract ID from memo → updates Sheets status to PAID.
 * @param {string} paymentId - QB Payment ID from the webhook payload
 */
const handleQBPaymentWebhook = async (paymentId) => {
  const sheetsService = require('./sheetsService');

  try {
    await refreshTokenIfNeeded();
    const qbo = buildQbClient();

    // 1. Fetch the Payment from QB
    const payment = await new Promise((resolve, reject) => {
      qbo.getPayment(paymentId, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });

    console.log(`[QB Webhook] Payment ${paymentId} fetched — Amount: $${payment.TotalAmt}`);

    // 2. Find all Invoice IDs linked to this payment
    const linkedInvoiceIds = [];
    for (const line of payment.Line || []) {
      for (const txn of line.LinkedTxn || []) {
        if (txn.TxnType === 'Invoice') {
          linkedInvoiceIds.push(txn.TxnId);
        }
      }
    }

    if (linkedInvoiceIds.length === 0) {
      console.warn(`[QB Webhook] No linked invoices found for payment ${paymentId}`);
      return;
    }

    // 3. For each invoice, extract Contract ID from CustomerMemo and update Sheets
    for (const invoiceId of linkedInvoiceIds) {
      const invoice = await new Promise((resolve, reject) => {
        qbo.getInvoice(invoiceId, (err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      });

      const memo = invoice.CustomerMemo?.value || '';
      // Contract ID is stored as "Contract ID: abc123" in the memo
      const match = memo.match(/Contract ID:\s*([^\n]+)/);
      const contractId = match?.[1]?.trim();

      if (!contractId) {
        console.warn(`[QB Webhook] No Contract ID found in Invoice ${invoiceId} memo`);
        continue;
      }

      console.log(`[QB Webhook] Invoice ${invoiceId} → Contract ID: ${contractId} — marking PAID`);
      await sheetsService.syncPaymentStatus(contractId, 'PAID');
      console.log(`[QB Webhook] ✅ Google Sheets updated: ${contractId} → PAID`);
    }
  } catch (e) {
    console.error(`[QB Webhook] ❌ Error processing payment ${paymentId}:`, e.message);
    throw e;
  }
};

module.exports = {
  getAuthUri,
  createToken,
  processContractSignatureForQB,
  sendInvoiceEmail,
  isAuthenticated,
  getTokenStatus,
  handleQBPaymentWebhook
};
