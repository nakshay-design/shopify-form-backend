document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        // Make sure we're capturing the submit event properly
        form.addEventListener('submit', async function(event) {
            // Always prevent the default form submission
            event.preventDefault(); // This line was missing!
            
            // Only process if it's not already being handled by Shopify
            if (!form.classList.contains('shopify-handled')) {
                const formData = new FormData(form);
                const formJson = {};
                
                formData.forEach((value, key) => {
                    formJson[key] = value;
                });
                
                // Print the form data to console
                console.log('Submitted Form Data :', formJson);
                
                // Get table data for products
                const productItems = [];
                const rows = document.querySelectorAll('#repeaterRows tr');
                
                rows.forEach((row, index) => {
                    const typeSelect = row.querySelector('select[name^="product_type"]');
                    const unitSelect = row.querySelector('select[name^="product_unit"]');
                    const nameInput = row.querySelector('input[name^="product_name"]');
                    const weightInput = row.querySelector('input[name^="product_weight"]');
                    const imageInput = row.querySelector('input[name^="product_image"]');
                    const priceInput = row.querySelector('input[name^="product_price"]');
                    
                    if (typeSelect && nameInput && priceInput) {
                        productItems.push({
                            type: typeSelect.value,
                            unit: unitSelect ? unitSelect.value : '',
                            name: nameInput.value,
                            weight: weightInput ? weightInput.value : '',
                            image: imageInput ? imageInput.files[0]?.name || '' : '',
                            price: priceInput.value
                        });
                    }
                });
                
                // Print product items to console
                console.log('Product Items:', productItems);
                
                // Create the payload to send to the server
                const payload = {
                    firstname: formJson.firstname || '',
                    lastname: formJson.lastname || '',
                    email: formJson.email || '',
                    phone: formJson.phone || '',
                    street: formJson.street_address || '',
                    city: formJson.city || '',
                    state: formJson.state || '',
                    country: formJson.country || '',
                    zipcode: formJson.zipcode || '',
                    iban: formJson.iban || '',
                    bic: formJson.bic || '',
                    meta: {
                        // address: {
                        //     street: formJson.street_address || '',
                        //     city: formJson.city || '',
                        //     state: formJson.state || '',
                        //     country: formJson.country || '',
                        //     zipcode: formJson.zipcode || ''
                        // },
                        // banking: {
                        //     iban: formJson.iban || '',
                        //     bic: formJson.bic || ''
                        // },
                        purchaseDetails: {
                            ownAccount: formJson.own_account === 'on',
                            thirdParty: formJson.thirdParty === 'on',
                            thirdPartyName: formJson.third_party_name || '',
                            thirdPartyAddress: formJson.third_party_address || '',
                            products: productItems,
                            subtotal: formJson.subtotal || '0.00'
                        },
                        agreements: {
                            terms: formJson.terms === 'on',
                            cancellation: formJson.cancellation === 'on',
                            privacy: formJson.privacy === 'on'
                        }
                    }
                };
                
                // Print the final payload to console
                console.log('Payload being sent to server:', payload);
                
                // Store the form data in localStorage for debugging
                localStorage.setItem('lastFormSubmission', JSON.stringify(payload));
                
                try {
                    // Use a direct URL to your server - make sure this URL is correct and accessible
                    // Update the serverUrl to match the new port
                    const serverUrl = 'https://shopify-form-backend-rust.vercel.app'; 
                    const endpoint = `${serverUrl}/api/submit-form`;
                    
                    console.log('Sending request to server:', endpoint);
                    
                    // Send the form data to our local server
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    console.log('Response status:', response.status);
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Server error:', response.status, errorText);
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }
                    
                    const result = await response.json();
                    console.log('Server response:', result);
                    
                    if (result.success) {
                        alert('Form submitted successfully!');
                        form.reset();
                    } else {
                        alert('Error submitting form: ' + (result.error || 'Unknown error'));
                    }
                } catch (error) {
                    console.error('Error submitting form:', error);
                    
                    // Show error message with the data saved in localStorage
                    alert('Error submitting to server: ' + error.message + '\nData has been saved locally as backup.');
                }
                
                // Remove this duplicate code that was causing issues
                // alert('Form data captured successfully! Check browser console for details.');
                // console.log('Form submission data (stored in localStorage):', payload);
                // form.reset();
                
                // All commented code below this point should be removed
            }
        });
    });
    
    // Add script to handle the country dropdown
    populateCountries();
});

// Function to populate countries dropdown
function populateCountries() {
    const countries = [
        "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", 
        "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", 
        "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", 
        "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", 
        "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", 
        "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", 
        "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", 
        "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", 
        "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", 
        "Korea, North", "Korea, South", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", 
        "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", 
        "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", 
        "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", 
        "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", 
        "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", 
        "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", 
        "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", 
        "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", 
        "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", 
        "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", 
        "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
    ];
    
    const countrySelect = document.getElementById('country-select');
    if (countrySelect) {
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    }
}

// Function to toggle third party info visibility
function toggleThirdPartyInfo(checkbox) {
    const thirdPartyInfo = document.getElementById('thirdPartyInfo');
    if (thirdPartyInfo) {
        thirdPartyInfo.classList.toggle('hidden', !checkbox.checked);
    }
}

// Function to add a new row to the repeater table
function addRow() {
    const tbody = document.getElementById('repeaterRows');
    if (!tbody) return;
    
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td class="border p-2">
            <select name="product_type[]" class="w-full border rounded p-1">
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="platinum">Platinum</option>
                <option value="palladium">Palladium</option>
            </select>
        </td>
        <td class="border p-2">
            <select name="product_unit[]" class="w-full border rounded p-1">
                <option value="ounce">Ounce</option>
                <option value="gram">Gram</option>
                <option value="kilogram">Kilogram</option>
            </select>
        </td>
        <td class="border p-2">
            <input type="text" name="product_name[]" class="w-full border rounded p-1">
        </td>
        <td class="border p-2">
            <input type="number" name="product_weight[]" class="w-full border rounded p-1" step="0.01">
        </td>
        <td class="border p-2">
            <input type="file" name="product_image[]" class="w-full border rounded p-1">
        </td>
        <td class="border p-2">
            <input type="number" name="product_price[]" class="w-full border rounded p-1" step="0.01" onchange="updateSubtotal()">
        </td>
        <td class="border p-2">
            <button type="button" onclick="removeRow(this)" class="text-red-600">Remove</button>
        </td>
    `;
    
    tbody.appendChild(newRow);
}

// Function to remove a row from the repeater table
function removeRow(button) {
    const row = button.closest('tr');
    row.remove();
    updateSubtotal();
}

// Function to update the subtotal
function updateSubtotal() {
    const priceInputs = document.querySelectorAll('input[name^="product_price"]');
    let subtotal = 0;
    
    priceInputs.forEach(input => {
        const price = parseFloat(input.value) || 0;
        subtotal += price;
    });
    
    const subtotalCell = document.getElementById('subtotalCell');
    if (subtotalCell) {
        subtotalCell.value = subtotal.toFixed(2);
    }
}