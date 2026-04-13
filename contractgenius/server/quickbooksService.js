const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');

const oauthClient = new OAuthClient({
  clientId: process.env.QB_CLIENT_ID,
  clientSecret: process.env.QB_CLIENT_SECRET,
  environment: process.env.QB_ENVIRONMENT || 'sandbox',
  redirectUri: process.env.QB_REDIRECT_URI || 'http://localhost:3001/auth/callback',
});

let oauthToken = null;

const getAuthUri = () => {
  return oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'Init',
  });
};

const createToken = async (url) => {
  try {
    const authResponse = await oauthClient.createToken(url);
    oauthToken = authResponse.getJson();
    return oauthToken;
  } catch (e) {
    console.error('Error creating QB token:', e);
    throw e;
  }
};

const getQbClient = () => {
  if (!oauthToken) throw new Error("QuickBooks is not authenticated.");
  
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
    // Basic mapping, in a real app you'd query first to see if they exist
    const customer = {
      DisplayName: vendorData.company || vendorData.name || 'Cabana Vendor',
      PrimaryEmailAddr: { Address: vendorData.email }
    };
    
    // First, check if customer exists by DisplayName
    qbo.findCustomers({
      DisplayName: customer.DisplayName
    }, (err, customers) => {
      if (err) {
        console.error("Error finding customer:", err);
        return reject(err);
      }
      
      if (customers && customers.QueryResponse && customers.QueryResponse.Customer && customers.QueryResponse.Customer.length > 0) {
        // Return existing
        return resolve(customers.QueryResponse.Customer[0]);
      }
      
      // Create new
      qbo.createCustomer(customer, (err, newCustomer) => {
        if (err) {
          console.error("Error creating customer:", err);
          return reject(err);
        }
        resolve(newCustomer);
      });
    });
  });
};

const createInvoice = (qbo, customerId, contractData) => {
  return new Promise((resolve, reject) => {
    const vendorDetails = contractData.vendorDetails || contractData.vendor;
    
    const lines = [];
    
    // Base amount Line Item
    if (vendorDetails.baseAmount) {
      lines.push({
        Amount: vendorDetails.baseAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          // You ideally need an ItemRef here representing your actual sales items in QB.
          // Using a placeholder Item ID 1 (Services usually) for Sandbox
          ItemRef: { value: "1", name: "Services" },
          UnitPrice: vendorDetails.baseAmount,
          Qty: 1
        },
        Description: `Exhibitor Booth: ${vendorDetails.boothSize}`
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
        Description: `Contract Services`
      });
    }

    const invoiceParams = {
      CustomerRef: {
        value: customerId
      },
      Line: lines
    };

    if (lines.length === 0) {
       console.log("No amount info found to create invoice line items");
       return resolve(null);
    }

    qbo.createInvoice(invoiceParams, (err, invoice) => {
      if (err) {
        console.error("Error creating invoice:", err);
        return reject(err);
      }
      resolve(invoice);
    });
  });
};

const processContractSignatureForQB = async (contractData) => {
  try {
    const qbo = getQbClient();
    const vendorData = contractData.vendorDetails || contractData.vendor;
    
    const customer = await createCustomer(qbo, vendorData);
    const invoice = await createInvoice(qbo, customer.Id, contractData);
    
    return invoice;
  } catch(e) {
    console.error("QB Integration Failed during signature:", e);
    // Don't throw, we don't want to break the main signature flow if QB fails
    return null;
  }
};

module.exports = {
  getAuthUri,
  createToken,
  processContractSignatureForQB
};
