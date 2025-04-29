document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            if (!form.classList.contains('shopify-handled')) {
                const formData = new FormData(form);
                const formJson = {};
                
                formData.forEach((value, key) => {
                    formJson[key] = value;
                });
                
                const productItems = [];
                const rows = document.querySelectorAll('#repeaterRows tr');
                
                rows.forEach((row, index) => {
                    const typeSelect = row.querySelector('select[name^="description"]');
                    const unitSelect = row.querySelector('select[name^="unit"]');
                    const nameInput = row.querySelector('input[name^="tax"]');
                    const weightInput = row.querySelector('input[name^="weight"]');
                    const imageInput = row.querySelector('input[name^="image[row-"]');
                    const priceInput = row.querySelector('input[name^="price"]');
                    
                    if (typeSelect && nameInput && priceInput) {
                        const imageNames = imageInput ? Array.from(imageInput.files).map(file => file.name) : [];
                        
                        productItems.push({
                            type: typeSelect.value,
                            unit: unitSelect ? unitSelect.value : '',
                            name: nameInput.value,
                            weight: weightInput ? weightInput.value : '',
                            images: imageNames,
                            price: priceInput.value
                        });

                        // Display image names
                        const previewContainer = row.querySelector(`#preview-row-${index}`);
                        if (previewContainer) {
                            previewContainer.innerHTML = ''; // Clear previous previews
                            imageNames.forEach(name => {
                                const img = document.createElement('img');
                                img.alt = name; // Set the image name as alt text
                                img.className = 'w-16 h-16 object-cover border rounded';
                                previewContainer.appendChild(img);
                            });
                        }
                    }
                });
                
                console.log('Product Items:', productItems);
                
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
                        ownAccount: formJson.own_account === 'on',
                        thirdParty: formJson.thirdParty === 'on',
                        thirdPartyName: formJson.third_party_name || '',
                        thirdPartyAddress: formJson.third_party_address || '',
                        purchaseDetails: {
                            products: productItems,
                            subtotal: formJson.subtotal || '0.00'
                        },
                        agreements: {
                            termsandcondition: formJson.terms === 'on',
                            cancellationpolicy: formJson.cancellation === 'on',
                            privacypolicy: formJson.privacy === 'on'
                        }
                    }
                };
                
                console.log('Payload being sent to server:', payload);
                
                localStorage.setItem('lastFormSubmission', JSON.stringify(payload));
                
                try {
                    const serverUrl = 'https://shopify-form-backend-rust.vercel.app'; 
                    const endpoint = `${serverUrl}/api/submit-form`;
                    
                    console.log('Sending request to server:', endpoint);
                    
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json' // Ensure the Accept header is set correctly
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
                    alert('Error submitting to server: ' + error.message + '\nData has been saved locally as backup.');
                }
            }
        });
    });
});