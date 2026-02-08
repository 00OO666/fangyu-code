/**
 * Product Search Autocomplete v5.0
 * Real-time product search with autocomplete
 * 支持所有搜索框（.search-box-compact 和 .search-box）
 * 空输入不跳转，有内容跳转到匹配的分类页面
 */

(function() {
    'use strict';

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // 找到所有搜索表单
        var searchForms = document.querySelectorAll('form.search-box-compact, form.search-box');

        if (!searchForms.length) return;

        // 共享的产品数据和搜索状态
        var products = [];
        var lastSearchResults = [];
        var lastMatchedCategory = null;
        var debounceTimer;

        // 对每个搜索表单进行初始化
        searchForms.forEach(function(searchForm) {
            initSearchForm(searchForm);
        });

        // 加载产品数据
        loadProducts();

        function initSearchForm(searchForm) {
            // 找到输入框和按钮（支持两种类不同的选择器）
            var searchInput = searchForm.querySelector('.search-input, .input-text, input[name="keyword"]');
            var searchBtn = searchForm.querySelector('.search-btn, .submit, button[type="submit"]');

            if (!searchInput) return;

            // 创建自动完成下拉列表（仅为主搜索框创建）
            var autocompleteList = null;
            if (searchForm.classList.contains('search-box-compact')) {
                autocompleteList = document.createElement('div');
                autocompleteList.className = 'search-autocomplete-list';
                autocompleteList.style.display = 'none';
                searchForm.appendChild(autocompleteList);
            }

            var currentFocus = -1;

            // 阻止表单默认提交
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();
                handleSearch();
            });

            // 点击搜索按钮
            if (searchBtn) {
                searchBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    handleSearch();
                });
            }

            // 处理搜索
            function handleSearch() {
                var query = searchInput.value.trim();

                // 空输入不做任何操作
                if (!query) { return; }

                // 优先使用最近搜索结果的第一个产品（精确到页码）
                if (lastSearchResults.length > 0 && lastSearchResults[0].category_url_with_page) {
                    window.location.href = lastSearchResults[0].category_url_with_page;
                    return;
                }

                // 如果没有产品但有匹配的分类，跳转到分类首页
                if (lastMatchedCategory && lastMatchedCategory.category_url) {
                    window.location.href = lastMatchedCategory.category_url;
                    return;
                }

                // 否则，发起 API 请求获取匹配产品
                fetch('/api-products.php?q=' + encodeURIComponent(query))
                    .then(function(response) { return response.json(); })
                    .then(function(data) {
                        if (data.success) {
                            // 优先使用第一个匹配产品的精确页码
                            if (data.products.length > 0 && data.products[0].category_url_with_page) {
                                window.location.href = data.products[0].category_url_with_page;
                            } else if (data.matched_category && data.matched_category.category_url) {
                                // 如果没有产品，使用匹配的分类首页
                                window.location.href = data.matched_category.category_url;
                            } else {
                                // 兜底：跳转到产品首页
                                window.location.href = '/?products_1/';
                            }
                        } else {
                            window.location.href = '/?products_1/';
                        }
                    })
                    .catch(function(error) {
                        console.error('Search error:', error);
                        window.location.href = '/?products_1/';
                    });
            }

            // 输入时实时搜索（仅有自动完成的表单）
            searchInput.addEventListener('input', function(e) {
                var query = e.target.value.trim();
                clearTimeout(debounceTimer);

                if (query.length < 1) {
                    if (autocompleteList) hideAutocomplete();
                    lastSearchResults = [];
                    lastMatchedCategory = null;
                    return;
                }

                debounceTimer = setTimeout(function() {
                    searchProducts(query, autocompleteList);
                }, 200);
            });

            // 键盘导航
            searchInput.addEventListener('keydown', function(e) {
                if (!autocompleteList) {
                    // 没有自动完成的简单处理
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                    }
                    return;
                }

                var items = autocompleteList.querySelectorAll('.search-item');

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    currentFocus++;
                    setActive(items);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    currentFocus--;
                    setActive(items);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (currentFocus > -1 && items[currentFocus]) {
                        items[currentFocus].click();
                    } else {
                        handleSearch();
                    }
                } else if (e.key === 'Escape') {
                    hideAutocomplete();
                }
            });

            // 点击外部关闭
            if (autocompleteList) {
                document.addEventListener('click', function(e) {
                    if (!searchForm.contains(e.target)) {
                        hideAutocomplete();
                    }
                });
            }

            // 设置激活项
            function setActive(items) {
                if (!items.length) return;
                removeActive(items);

                if (currentFocus >= items.length) currentFocus = 0;
                if (currentFocus < 0) currentFocus = items.length - 1;

                items[currentFocus].classList.add('search-item-active');
            }

            // 移除激活状态
            function removeActive(items) {
                for (var i = 0; i < items.length; i++) {
                    items[i].classList.remove('search-item-active');
                }
            }

            // 隐藏下拉列表
            function hideAutocomplete() {
                if (autocompleteList) {
                    autocompleteList.style.display = 'none';
                    currentFocus = -1;
                }
            }
        }

        // 加载所有产品数据
        function loadProducts() {
            fetch('/api-products.php')
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.success) {
                        products = data.products;
                    }
                })
                .catch(function(error) {
                    console.error('Failed to load products:', error);
                });
        }

        // 搜索产品
        function searchProducts(query, autocompleteList) {
            fetch('/api-products.php?q=' + encodeURIComponent(query))
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.success) {
                        lastSearchResults = data.products;
                        lastMatchedCategory = data.matched_category || null;
                        if (autocompleteList) {
                            displayResults(data.products, query, autocompleteList);
                        }
                    }
                })
                .catch(function(error) {
                    console.error('Search error:', error);
                });
        }

        // 显示搜索结果
        function displayResults(results, query, autocompleteList) {
            if (!autocompleteList) return;

            if (results.length === 0) {
                autocompleteList.innerHTML = '<div class="search-no-results"><p>No products found for "' + escapeHtml(query) + '"</p><a href="/?products_1/" class="view-all-link">View all products</a></div>';
                showAutocomplete(autocompleteList);
                return;
            }

            var html = '';
            results.forEach(function(product) {
                html += '<a href="' + product.url + '" class="search-item">';
                if (product.image) {
                    html += '<img src="' + product.image + '" alt="' + escapeHtml(product.title) + '" loading="lazy">';
                }
                html += '<div class="search-item-info">';
                html += '<div class="search-item-title">' + highlightQuery(product.title, query) + '</div>';
                if (product.subtitle) {
                    html += '<div class="search-item-subtitle">' + escapeHtml(product.subtitle) + '</div>';
                }
                html += '</div></a>';
            });

            html += '<a href="/?products_1/" class="search-view-all">View all products<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12,5 19,12 12,19"></polyline></svg></a>';

            autocompleteList.innerHTML = html;
            showAutocomplete(autocompleteList);
        }

        // HTML 转义
        function escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // 高亮关键词
        function highlightQuery(text, query) {
            var safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var regex = new RegExp('(' + safeQuery + ')', 'gi');
            return escapeHtml(text).replace(regex, '<mark>$1</mark>');
        }

        // 显示下拉列表
        function showAutocomplete(autocompleteList) {
            if (autocompleteList) {
                autocompleteList.style.display = 'block';
            }
        }
    }
})();
