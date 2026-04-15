const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const fs = require('fs');
const path = require('path');

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
    console.log('[QB] Token saved to file');
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

const refreshTokenIfNeeded = async () => {
  if (!oauthToken) {
    throw new Error("QuickBooks is not authenticated. No token found.");
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = oauthToken.expires_in ? oauthToken.created_at + oauthToken.expires_in : 0;
  
  if (expiresAt && now >= expiresAt - 300) {
    console.log('[QB] Token expired or about to expire, refreshing...');
    try {
      oauthClient.setToken(oauthToken);
      const newToken = await oauthClient.refresh();
      saveToken(newToken.getJson());
      console.log('[QB] Token refreshed successfully');
    } catch (e) {
      console.error('[QB] Error refreshing token:', e);
      throw e;
    }
  }
};

const getQbClient = async () => {
  if (!oauthToken) throw new Error("QuickBooks is not authenticated.");
  
  await refreshTokenIfNeeded();
  
  return new QuickBooks(
    process.env.QB_CLIENT_ID,
    process.env.QB_CLIENT_SECRET,
    oauthToken.access_token,
    false, // no token secret for oAuth 2.0
    process.env.QB_COMPANY_ID,
    process.env.QB_ENVIRONMENT === 'sandbox', // useSandbox
    true, // enable debugging
    null, // minorversion
    '2.0', // oauthversion
    oauthToken.refresh_token
  );
};

const createCustomer = (qbo, vendorData) => {
  return new Promise((resolve, reject) => {
    const displayName = vendorData.company || vendorData.name || 'Cabana Vendor';
    
    const customer = {
      DisplayName: displayName,
      PrimaryEmailAddr: { Address: vendorData.email },
      PrimaryPhone: vendorData.phone ? { FreeFormNumber: vendorData.phone } : undefined,
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
    const vendorDetails = contractData.vendorDetails || contractData.vendor;
    
    const lines = [];
    
    // Deposit amount Line Item (if deposit was paid)
    if (vendorDetails.depositAmount && vendorDetails.depositAmount > 0) {
      lines.push({
        Amount: vendorDetails.depositAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: vendorDetails.depositAmount,
          Qty: 1
        },
        Description: `Exhibitor Booth Deposit - ${vendorDetails.boothSize || 'Standard Booth'}`
      });
    }

    // Balance amount Line Item
    if (vendorDetails.balanceAmount && vendorDetails.balanceAmount > 0) {
      lines.push({
        Amount: vendorDetails.balanceAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: vendorDetails.balanceAmount,
          Qty: 1
        },
        Description: `Exhibitor Booth Balance - ${vendorDetails.boothSize || 'Standard Booth'}`
      });
    }
    
    // Base amount Line Item (fallback if deposit/balance not set)
    if (lines.length === 0 && vendorDetails.baseAmount) {
      lines.push({
        Amount: vendorDetails.baseAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: vendorDetails.baseAmount,
          Qty: 1
        },
        Description: `Exhibitor Booth: ${vendorDetails.boothSize || 'Standard Booth'}`
      });
    }

    // CC Fee Line Item
    if (vendorDetails.ccFee) {
      lines.push({
        Amount: vendorDetails.ccFee,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: vendorDetails.ccFee,
          Qty: 1
        },
        Description: "2.99% Credit Card Processing Fee"
      });
    }

    // Fixture Line Items (if selected)
    const selectedFixtures = vendorDetails.selectedFixtures || vendorDetails.fixtures || [];
    if (Array.isArray(selectedFixtures) && selectedFixtures.length > 0) {
      selectedFixtures.forEach(fixture => {
        const fixtureTotal = (fixture.quantity || 1) * (fixture.price || 0);
        if (fixtureTotal > 0) {
          lines.push({
            Amount: fixtureTotal,
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              ItemRef: { value: "1", name: "Services" },
              UnitPrice: fixture.price || 0,
              Qty: fixture.quantity || 1
            },
            Description: `${fixture.type || 'Fixture'} (Qty: ${fixture.quantity || 1})`
          });
        }
      });
    }
    
    // If no specific lines, but total exists
    if (lines.length === 0 && vendorDetails.totalAmount) {
       lines.push({
        Amount: vendorDetails.totalAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: vendorDetails.totalAmount,
          Qty: 1
        },
        Description: `Contract Services - ${vendorDetails.boothSize || 'Standard Booth'}`
      });
    }

    const invoiceParams = {
      CustomerRef: {
        value: customerId
      },
      Line: lines
    };

    if (lines.length === 0) {
       console.log("[QB] No amount info found to create invoice line items");
       return resolve(null);
    }

    console.log(`[QB] Creating invoice with ${lines.length} line items for customer ${customerId}`);
    
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
    
    const qbo = await getQbClient();
    const vendorData = contractData.vendorDetails || contractData.vendor;
    
    if (!vendorData || !vendorData.email) {
      console.log("[QB] Skipping - No vendor data or email");
      return null;
    }
    
    console.log(`[QB] Processing contract for: ${vendorData.company || vendorData.name}`);
    
    const customer = await createCustomer(qbo, vendorData);
    const invoice = await createInvoice(qbo, customer.Id, contractData);
    
    if (invoice) {
      console.log(`[QB] ✅ Invoice ${invoice.Id} created for ${vendorData.company || vendorData.name}`);
    }
    
    return invoice;
  } catch(e) {
    console.error("[QB] ❌ Integration Failed during signature:", e.message);
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

module.exports = {
  getAuthUri,
  createToken,
  processContractSignatureForQB,
  isAuthenticated,
  getTokenStatus
};
