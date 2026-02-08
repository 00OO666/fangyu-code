/**
 * 在线文档系统
 * 支持文档搜索、版本控制、展示
 */

(function() {
    'use strict';

    const DocsSystem = {
        config: {},
        docs: [],

        init: function(config) {
            config = config || {};
            this.config = config;
            console.log('Docs System initialized');
            this.loadDocs();
        },

        loadDocs: function() {
            const self = this;
            fetch('/api-docs.php')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        self.docs = data.data;
                        self.renderDocs();
                    }
                })
                .catch(error => console.error('Failed to load docs:', error));
        },

        renderDocs: function() {
            const container = document.querySelector(this.config.containerSelector || '#docs-container');
            if (!container) return;

            let html = '<div class="docs-list">';
            this.docs.forEach(doc => {
                html += '<div class="doc-item">';
                html += '<h3>' + doc.title + '</h3>';
                html += '<p class="doc-category">' + doc.category + '</p>';
                html += '<p>' + doc.content + '</p>';
                html += '<div class="doc-versions">';
                doc.versions.forEach(version => {
                    html += '<span class="version-badge">' + version + '</span>';
                });
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        },

        search: function(query) {
            const self = this;
            if (!query) return;

            fetch('/api-search.php?q=' + encodeURIComponent(query))
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        self.displaySearchResults(data.results);
                    }
                })
                .catch(error => console.error('Search failed:', error));
        },

        displaySearchResults: function(results) {
            const container = document.querySelector(this.config.containerSelector || '#docs-container');
            if (!container) return;

            if (results.length === 0) {
                container.innerHTML = '<p class="no-results">No results found</p>';
                return;
            }

            let html = '<div class="search-results">';
            results.forEach(result => {
                html += '<div class="search-result-item">';
                html += '<h3>' + result.title + '</h3>';
                html += '<p>' + result.excerpt + '</p>';
                html += '<a href="' + result.url + '" class="result-link">Read More →</a>';
                html += '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        }
    };

    window.DocsSystem = DocsSystem;
})();
