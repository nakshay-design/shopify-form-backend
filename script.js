document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('shopifyForm');
    const formStatus = document.getElementById('formStatus');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(form);
        const formDataObj = {};
        formData.forEach((value, key) => {
            formDataObj[key] = value;
        });

        try {
            // Send data to our backend
            const response = await fetch('/api/submit-form', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formDataObj)
            });

            const data = await response.json();
            
            if (response.ok) {
                formStatus.textContent = 'Form submitted successfully!';
                formStatus.className = 'success';
                form.reset();
            } else {
                formStatus.textContent = data.error || 'Something went wrong. Please try again.';
                formStatus.className = 'error';
            }
        } catch (error) {
            console.error('Error:', error);
            formStatus.textContent = 'An error occurred. Please try again later.';
            formStatus.className = 'error';
        }
    });
});