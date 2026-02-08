/**
 * AI 自动化组件
 * 支持客服回复、SEO建议、产品推荐
 */

(function() {
    'use strict';

    const AIAutomation = {
        config: {},

        init: function(config) {
            config = config || {};
            this.config = config;
            this.setupCustomerService();
            this.setupSEOAdvisor();
            console.log('AI Automation initialized');
        },

        setupCustomerService: function() {
            const containers = document.querySelectorAll('[data-ai-customer-service]');
            containers.forEach(container => {
                const input = container.querySelector('[data-customer-query]');
                const btn = container.querySelector('[data-send-query]');
                const output = container.querySelector('[data-response-container]');

                if (input && btn && output) {
                    btn.addEventListener('click', () => {
                        this.generateCustomerResponse(input.value, output);
                    });
                }
            });
        },

        generateCustomerResponse: function(query, outputElement) {
            if (!query.trim()) return;

            outputElement.innerHTML = '<div class="ai-loading">生成回复中...</div>';

            fetch('/api-ai-generate.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'customer_service',
                    query: query,
                    language: this.config.language || 'en'
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        outputElement.innerHTML = '<div class="ai-response">' + data.response + '</div>';
                    } else {
                        outputElement.innerHTML = '<div class="ai-error">Failed to generate response</div>';
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    outputElement.innerHTML = '<div class="ai-error">Error generating response</div>';
                });
        },

        setupSEOAdvisor: function() {
            const containers = document.querySelectorAll('[data-ai-seo-advisor]');
            containers.forEach(container => {
                const input = container.querySelector('[data-seo-content]');
                const btn = container.querySelector('[data-analyze-seo]');
                const output = container.querySelector('[data-seo-advice-container]');

                if (input && btn && output) {
                    btn.addEventListener('click', () => {
                        this.generateSEOAdvice(input.value, output);
                    });
                }
            });
        },

        generateSEOAdvice: function(content, outputElement) {
            if (!content.trim()) return;

            outputElement.innerHTML = '<div class="ai-loading">分析中...</div>';

            fetch('/api-ai-generate.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'seo_advisor',
                    content: content,
                    language: this.config.language || 'en'
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success && Array.isArray(data.advice)) {
                        let html = '<div class="ai-seo-advice"><ul>';
                        data.advice.forEach(item => {
                            html += '<li>' + item + '</li>';
                        });
                        html += '</ul></div>';
                        outputElement.innerHTML = html;
                    } else {
                        outputElement.innerHTML = '<div class="ai-error">Failed to generate advice</div>';
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    outputElement.innerHTML = '<div class="ai-error">Error analyzing content</div>';
                });
        }
    };

    window.AIAutomation = AIAutomation;
})();
