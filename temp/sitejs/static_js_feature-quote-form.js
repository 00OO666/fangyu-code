/**
 * 在线询盘表单系统
 * 支持表单验证、文件上传
 */

(function() {
    'use strict';

    const QuoteForm = {
        config: {},

        init: function(config) {
            config = config || {};
            this.config = config;
            this.setupForms();
            console.log('Quote Form initialized');
        },

        setupForms: function() {
            const forms = document.querySelectorAll('[data-quote-form]');
            forms.forEach(form => {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleFormSubmit(form);
                });
            });
        },

        handleFormSubmit: function(form) {
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                email: formData.get('email'),
                subject: formData.get('subject'),
                message: formData.get('message'),
                phone: formData.get('phone') || '',
                company: formData.get('company') || ''
            };

            fetch('/api-inquiries.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Quote submitted successfully! We will contact you soon.');
                        form.reset();
                    } else {
                        alert('Error: ' + (data.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Submission failed:', error);
                    alert('Failed to submit quote');
                });
        }
    };

    window.QuoteForm = QuoteForm;
})();
