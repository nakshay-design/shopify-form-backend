require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const app = express();
const PORT = 'https://shopify-form-backend-rust.vercel.app';

// Shopify API configuration
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Validate Shopify configuration at startup
console.log('Environment check:', {
  SHOPIFY_SHOP: SHOPIFY_SHOP ? 'Set' : 'Missing',
  SHOPIFY_ACCESS_TOKEN: SHOPIFY_ACCESS_TOKEN ? `Set (first 5 chars: ${SHOPIFY_ACCESS_TOKEN.substring(0, 5)}...)` : 'Missing',
});

if (!SHOPIFY_SHOP || !SHOPIFY_ACCESS_TOKEN) {
  console.error('ERROR: Missing Shopify configuration. Please check your .env file.');
  console.error('Required: SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// API endpoint to handle form submissions
app.post('/api/submit-form', async (req, res) => {
  try {
    const formData = req.body;
    
    // Log the received data
    console.log('Received form submission:', formData);
    
    // Generate a unique filename based on timestamp and email
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const email = formData.email?.replace(/[@.]/g, '-') || 'no-email';
    const filename = `${timestamp}-${email}.json`;
    
    // Save the form data to a JSON file with better formatting
    fs.writeFileSync(
      path.join(dataDir, filename),
      JSON.stringify(formData, null, 2)
    );
    
    // Create a more human-readable version for debugging
    const readableFilename = `${timestamp}-${email}-readable.txt`;
    let readableContent = `Form Submission at ${new Date().toLocaleString()}\n\n`;
    readableContent += `Name: ${formData.name || 'Not provided'}\n`;
    readableContent += `Email: ${formData.email || 'Not provided'}\n`;
    readableContent += `Phone: ${formData.phone || 'Not provided'}\n\n`;
    
    // Parse the message JSON if it's a string
    let messageData = formData.message;
    if (typeof messageData === 'string') {
      try {
        messageData = JSON.parse(messageData);
      } catch (e) {
        console.error('Error parsing message JSON:', e);
        messageData = {};
      }
      
      // Add address information
      if (messageData.address) {
        readableContent += `Address Information:\n`;
        readableContent += `  Street: ${messageData.address.street || 'Not provided'}\n`;
        readableContent += `  City: ${messageData.address.city || 'Not provided'}\n`;
        readableContent += `  State: ${messageData.address.state || 'Not provided'}\n`;
        readableContent += `  Country: ${messageData.address.country || 'Not provided'}\n`;
        readableContent += `  Zip Code: ${messageData.address.zipcode || 'Not provided'}\n\n`;
      }
      
      // Add banking information
      if (messageData.banking) {
        readableContent += `Banking Information:\n`;
        readableContent += `  IBAN: ${messageData.banking.iban || 'Not provided'}\n`;
        readableContent += `  BIC: ${messageData.banking.bic || 'Not provided'}\n\n`;
      }
      
      // Add purchase details
      if (messageData.purchaseDetails) {
        readableContent += `Purchase Details:\n`;
        readableContent += `  Own Account: ${messageData.purchaseDetails.ownAccount ? 'Yes' : 'No'}\n`;
        readableContent += `  Third Party: ${messageData.purchaseDetails.thirdParty ? 'Yes' : 'No'}\n`;
        
        if (messageData.purchaseDetails.thirdParty) {
          readableContent += `  Third Party Name: ${messageData.purchaseDetails.thirdPartyName || 'Not provided'}\n`;
          readableContent += `  Third Party Address: ${messageData.purchaseDetails.thirdPartyAddress || 'Not provided'}\n`;
        }
        
        if (messageData.purchaseDetails.products && messageData.purchaseDetails.products.length > 0) {
          readableContent += `\n  Products:\n`;
          messageData.purchaseDetails.products.forEach((product, index) => {
            readableContent += `    Product ${index + 1}:\n`;
            readableContent += `      Type: ${product.type || 'Not provided'}\n`;
            readableContent += `      Unit: ${product.unit || 'Not provided'}\n`;
            readableContent += `      Name: ${product.name || 'Not provided'}\n`;
            readableContent += `      Weight: ${product.weight || 'Not provided'}\n`;
            readableContent += `      Price: ${product.price || 'Not provided'}\n`;
          });
          readableContent += `\n  Subtotal: ${messageData.purchaseDetails.subtotal || '0.00'}\n\n`;
        }
      }
      
      // Add agreements
      if (messageData.agreements) {
        readableContent += `Agreements:\n`;
        readableContent += `  Terms: ${messageData.agreements.terms ? 'Accepted' : 'Not accepted'}\n`;
        readableContent += `  Cancellation: ${messageData.agreements.cancellation ? 'Accepted' : 'Not accepted'}\n`;
        readableContent += `  Privacy: ${messageData.agreements.privacy ? 'Accepted' : 'Not accepted'}\n\n`;
      }
    }
    
    // Save the readable content
    fs.writeFileSync(
      path.join(dataDir, readableFilename),
      readableContent
    );
    
    console.log(`Form data saved to ${path.join(dataDir, filename)}`);
    console.log(`Readable version saved to ${path.join(dataDir, readableFilename)}`);
    
    // Try creating a Shopify metaobject using GraphQL API
    try {
      // Parse the message JSON if it's a string
      if (typeof formData.message === 'string') {
        try {
          messageData = JSON.parse(formData.message);
        } catch (e) {
          console.error('Error parsing message JSON:', e);
          messageData = {};
        }
      }
      
      // Create metaobject entry in Shopify using GraphQL
      const metaobjectResponse = await createShopifyMetaobjectGraphQL(formData, messageData);
      console.log('Shopify metaobject created successfully:', metaobjectResponse);
      
      // Return success response
      res.status(200).json({
        success: true,
        message: 'Form data received and stored successfully',
        filename,
        shopifyMetaobject: metaobjectResponse
      });
    } catch (shopifyError) {
      console.error('Error creating Shopify metaobject:', shopifyError);
      
      // Fall back to REST API if GraphQL fails
      try {
        console.log('Falling back to REST API...');
        const restResponse = await createShopifyMetaobjectREST(formData, messageData);
        console.log('Shopify metaobject created with REST API:', restResponse);
        
        res.status(200).json({
          success: true,
          message: 'Form data stored successfully using REST API',
          filename,
          shopifyMetaobject: restResponse
        });
      } catch (restError) {
        console.error('REST API fallback also failed:', restError);
        
        // Return error but indicate local storage succeeded
        res.status(207).json({
          success: true,
          localStorageSuccess: true,
          shopifySuccess: false,
          message: 'Form data stored locally, but failed to create Shopify metaobject',
          filename,
          shopifyError: restError.message
        });
      }
    }
  } catch (error) {
    console.error('Error processing form submission:', error);
    res.status(500).json({
      success: false,
      error: 'Server error processing your request: ' + error.message
    });
  }
});

// Function to create a metaobject in Shopify using GraphQL API (preferred method)
async function createShopifyMetaobjectGraphQL(formData, messageData) {
  console.log('Creating Shopify metaobject with GraphQL API');
  
  // Generate a unique handle
  const handle = `form-submission-${Date.now()}`;
  
  // Create the GraphQL mutation
  const mutation = `
    mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  // Format the data for fields
  const variables = {
    metaobject: {
      handle,
      type: "form_submission",
      fields: [
        { key: "name", value: formData.name || "" },
        { key: "email", value: formData.email || "" },
        { key: "phone", value: formData.phone || "" },
        { key: "address", value: JSON.stringify(messageData.address || {}) },
        { key: "banking", value: JSON.stringify(messageData.banking || {}) },
        { key: "purchase_details", value: JSON.stringify(messageData.purchaseDetails || {}) },
        { key: "agreements", value: JSON.stringify(messageData.agreements || {}) },
        { key: "submission_date", value: new Date().toISOString() }
      ]
    }
  };
  
  console.log('GraphQL Variables:', JSON.stringify(variables, null, 2));
  
  // Send to Shopify GraphQL API
  const apiUrl = `https://${SHOPIFY_SHOP}/admin/api/2024-01/graphql.json`;
  console.log('Sending GraphQL request to:', apiUrl);
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify({
      query: mutation,
      variables
    })
  });
  
  const responseData = await response.json();
  
  // Log response data for debugging
  console.log('GraphQL Response Status:', response.status);
  console.log('GraphQL Response:', JSON.stringify(responseData, null, 2));
  
  if (response.status >= 400 || (responseData.data?.metaobjectCreate?.userErrors?.length > 0)) {
    const errors = responseData.data?.metaobjectCreate?.userErrors || [];
    const errorMessages = errors.map(err => `${err.field}: ${err.message}`).join(', ');
    throw new Error(`Shopify GraphQL API error: ${response.status} ${errorMessages || JSON.stringify(responseData.errors)}`);
  }
  
  return responseData.data.metaobjectCreate.metaobject;
}

// Fallback: Function to create a metaobject in Shopify using REST API
async function createShopifyMetaobjectREST(formData, messageData) {
  console.log('Creating Shopify metaobject with REST API');
  
  // Construct the metaobject data
  const metaobjectData = {
    metaobject: {
      handle: `form-submission-${Date.now()}`,
      type: "form_submission",
      fields: [
        { key: "name", value: formData.name || "" },
        { key: "email", value: formData.email || "" },
        { key: "phone", value: formData.phone || "" },
        { key: "address", value: JSON.stringify(messageData.address || {}) },
        { key: "banking", value: JSON.stringify(messageData.banking || {}) },
        { key: "purchase_details", value: JSON.stringify(messageData.purchaseDetails || {}) },
        { key: "agreements", value: JSON.stringify(messageData.agreements || {}) },
        { key: "submission_date", value: new Date().toISOString() }
      ]
    }
  };

  console.log('REST API Request Body:', JSON.stringify(metaobjectData, null, 2));

  // Send to Shopify REST API
  const apiUrl = `https://${SHOPIFY_SHOP}/admin/api/2024-01/metaobjects.json`;
  console.log('Sending request to Shopify REST API:', apiUrl);
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify(metaobjectData)
  });

  const responseText = await response.text();
  console.log('REST API Response Status:', response.status);
  console.log('REST API Response Headers:', Object.fromEntries([...response.headers]));
  console.log('REST API Response Body:', responseText);

  if (!response.ok) {
    throw new Error(`Shopify REST API error: ${response.status} ${responseText}`);
  }

  // Parse the response if it's valid JSON
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.warn('Could not parse REST API response as JSON:', e);
    return { text: responseText };
  }
}

// Add a GET endpoint for testing
app.get('/api/submit-form', (req, res) => {
  res.status(200).json({
    message: 'API endpoint is working. Please use POST method to submit form data.'
  });
});

// Add a GET endpoint to retrieve form submissions
app.get('/api/submissions', (req, res) => {
  try {
    // Read all files in the data directory
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
    
    // Sort files by creation time (newest first)
    files.sort((a, b) => {
      return fs.statSync(path.join(dataDir, b)).mtime.getTime() - 
             fs.statSync(path.join(dataDir, a)).mtime.getTime();
    });
    
    // Limit to the 10 most recent submissions
    const recentFiles = files.slice(0, 10);
    
    // Read and parse each file
    const submissions = recentFiles.map(file => {
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // Add metadata
      return {
        id: file.replace('.json', ''),
        timestamp: fs.statSync(filePath).mtime,
        ...data
      };
    });
    
    res.status(200).json({
      success: true,
      submissions
    });
  } catch (error) {
    console.error('Error retrieving submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving submissions: ' + error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on https://shopify-form-backend-rust.vercel.app`);
  console.log(`Form available at https://shopify-form-backend-rust.vercel.app`);
});