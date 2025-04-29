require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const app = express();

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
    console.log('Received form submission:', formData);
    
    let metaData = formData.meta;
    if (typeof metaData === 'string') {
      try {
        metaData = JSON.parse(metaData);
      } catch (e) {
        console.error('Error parsing meta JSON:', e);
        metaData = {};
      }
    }
    
    // Try creating a Shopify metaobject using GraphQL API
    try {
      const metaobjectResponse = await createShopifyMetaobjectGraphQL(formData, metaData);
      console.log('Shopify metaobject created successfully:', metaobjectResponse);
      
      res.status(200).json({
        success: true,
        message: 'Form data received and stored successfully',
        shopifyMetaobject: metaobjectResponse
      });
    } catch (shopifyError) {
      console.error('Error creating Shopify metaobject:', shopifyError);
      
      // Fall back to REST API if GraphQL fails
      try {
        console.log('Falling back to REST API...');
        const restResponse = await createShopifyMetaobjectREST(formData, metaData);
        console.log('Shopify metaobject created with REST API:', restResponse);
        
        res.status(200).json({
          success: true,
          message: 'Form data stored successfully using REST API',
          shopifyMetaobject: restResponse
        });
      } catch (restError) {
        console.error('REST API fallback also failed:', restError);
        throw restError;
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
async function createShopifyMetaobjectGraphQL(formData, metaData) {
  const handle = `form-submission-${Date.now()}`;
  
  // Format purchase details as an HTML table
  const purchaseDetailsTable = `
    <table border="1">
      <thead>
        <tr>
          <th>Type</th>
          <th>Unit</th>
          <th>Name</th>
          <th>Weight</th>
          <th>Price</th>
          <th>Images</th>
        </tr>
      </thead>
      <tbody>
        ${metaData.purchaseDetails.products.map(product => `
          <tr>
            <td>${product.type}</td>
            <td>${product.unit}</td>
            <td>${product.name}</td>
            <td>${product.weight}</td>
            <td>${product.price}</td>
            <td>${product.images.join(', ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

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

  const variables = {
    metaobject: {
      handle,
      type: "form_submission",
      fields: [
        { key: "first_name", value: formData.firstname || "" },
        { key: "last_name", value: formData.lastname || "" },
        { key: "email", value: formData.email || "" },
        { key: "telephone", value: formData.phone || "" },
        { key: "street_address", value: formData.street || "" },
        { key: "city", value: formData.city || "" },
        { key: "state", value: formData.state || "" },
        { key: "country", value: formData.country || "" },
        { key: "zip_code", value: formData.zipcode || "" },
        { key: "iban", value: formData.iban || "" },
        { key: "bic", value: formData.bic || "" },
        { key: "own_account", value: JSON.stringify(metaData.ownAccount || "") },
        { key: "third_party", value: JSON.stringify(metaData.thirdParty || "") },
        { key: "third_party_name", value: JSON.stringify(metaData.thirdPartyName || "") },
        { key: "third_party_address", value: JSON.stringify(metaData.thirdPartyAddress || "") },
        { key: "purchase_details", value: JSON.stringify(metaData.purchaseDetails || {}) },
        { key: "product_details", value: purchaseDetailsTable }, // Add HTML table to product_details
        { key: "agreements", value: JSON.stringify(metaData.agreements || {}) },
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
async function createShopifyMetaobjectREST(formData, metaData) {
  const handle = `form-submission-${Date.now()}`;

  // Format purchase details as an HTML table
  const purchaseDetailsTable = `
    <table border="1">
      <thead>
        <tr>
          <th>Type</th>
          <th>Unit</th>
          <th>Name</th>
          <th>Weight</th>
          <th>Price</th>
          <th>Images</th>
        </tr>
      </thead>
      <tbody>
        ${metaData.purchaseDetails.products.map(product => `
          <tr>
            <td>${product.type}</td>
            <td>${product.unit}</td>
            <td>${product.name}</td>
            <td>${product.weight}</td>
            <td>${product.price}</td>
            <td>${product.images.join(', ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const metaobjectData = {
    metaobject: {
      handle,
      type: "form_submission",
      fields: [
        { key: "first_name", value: formData.firstname || "" },
        { key: "last_name", value: formData.lastname || "" },
        { key: "email", value: formData.email || "" },
        { key: "telephone", value: formData.phone || "" },
        { key: "street_address", value: formData.street || "" },
        { key: "city", value: formData.city || "" },
        { key: "state", value: formData.state || "" },
        { key: "country", value: formData.country || "" },
        { key: "zip_code", value: formData.zipcode || "" },
        { key: "iban", value: formData.iban || "" },
        { key: "bic", value: formData.bic || "" },
        { key: "own_account", value: JSON.stringify(metaData.ownAccount || "")},
        { key: "third_party", value: JSON.stringify(metaData.thirdParty || "")},
        { key: "third_party_name", value: JSON.stringify(metaData.thirdPartyName || "") },
        { key: "third_party_address", value: JSON.stringify(metaData.thirdPartyAddress || "") },
        { key: "purchase_details", value: JSON.stringify(metaData.purchaseDetails || {}) },
        { key: "product_details", value: purchaseDetailsTable }, // Add HTML table to product_details
        { key: "agreements", value: JSON.stringify(metaData.agreements || {}) },
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

// Remove the PORT variable and modify the app.listen section
// For Vercel deployment, we just need to export the app
module.exports = app;