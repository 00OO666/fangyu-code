window.ProductNav = (function() {
    var state = {expandedCategoryIndex: null, activeCategoryIndex: null, activeSubcategoryIndex: null, isLoading: false};
    var elements = {navItems: null, productList: null, loadingOverlay: null, pagination: null};
    var currentRequest = null;

    function init() {
        var nav = document.querySelector(".product-nav");
        if (!nav) return;

        elements.navItems = document.querySelectorAll(".product-nav-item");
        elements.productList = document.getElementById("productList");
        elements.loadingOverlay = document.getElementById("productLoading");
        elements.pagination = document.querySelector(".mod_page");

        initStateFromDOM();
        bindEvents();
        bindPaginationLinks();
        handlePopState();

        if (window.history.replaceState) {
            window.history.replaceState({ path: window.location.href }, "", window.location.href);
        }
    }

    function initStateFromDOM() {
        elements.navItems.forEach(function(item, index) {
            if (item.classList.contains("current")) {
                state.activeCategoryIndex = index;
                var subItems = item.querySelectorAll(".product-subnav-item");
                var hasChildren = subItems.length > 0;

                subItems.forEach(function(subItem, subIndex) {
                    if (subItem.classList.contains("active")) {
                        state.activeSubcategoryIndex = subIndex;
                    }
                });

                if (hasChildren) {
                    state.expandedCategoryIndex = index;
                }
            }
        });
        updateUI();
    }

    function bindEvents() {
        elements.navItems.forEach(function(item, index) {
            var link = item.querySelector(".product-nav-link");
            var arrow = item.querySelector(".nav-arrow");
            var subnav = item.querySelector(".product-subnav");
            var subItems = subnav ? subnav.querySelectorAll(".product-subnav-item") : [];
            var hasChildren = subItems.length > 0;
            var url = link ? link.getAttribute("href") : null;

            if (!link) return;

            var clickHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                onMainCategoryClick(index, hasChildren, url);
            };

            link.addEventListener("click", clickHandler);

            if (arrow && hasChildren) {
                arrow.addEventListener("click", clickHandler);
            }

            subItems.forEach(function(subItem, subIndex) {
                var subLink = subItem.querySelector(".product-subnav-link");
                if (!subLink) return;
                var subUrl = subLink.getAttribute("href");

                subLink.addEventListener("click", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSubcategoryClick(index, subIndex, subUrl);
                });
            });
        });
    }

    function onMainCategoryClick(index, hasChildren, url) {
        var isSameCategory = (state.activeCategoryIndex === index);
        var isExpanded = (state.expandedCategoryIndex === index);

        if (isSameCategory) {
            if (isExpanded) {
                state.expandedCategoryIndex = null;
            } else {
                if (hasChildren) {
                    state.expandedCategoryIndex = index;
                }
            }
            state.activeSubcategoryIndex = null;
        } else {
            state.activeCategoryIndex = index;
            state.expandedCategoryIndex = hasChildren ? index : null;
            state.activeSubcategoryIndex = null;
        }

        updateUI();

        if (url) {
            loadProducts(url, true);
        }
    }

    function onSubcategoryClick(categoryIndex, subIndex, url) {
        state.activeCategoryIndex = categoryIndex;
        state.expandedCategoryIndex = categoryIndex;
        state.activeSubcategoryIndex = subIndex;

        updateUI();

        if (url) {
            loadProducts(url, true);
        }
    }

    function updateUI() {
        // 首先清除所有的active类
        var allSubItems = document.querySelectorAll(".product-subnav-item.active");
        allSubItems.forEach(function(item) {
            item.classList.remove("active");
        });

        // 然后更新所有导航项的current和expanded类
        elements.navItems.forEach(function(item, index) {
            var subnav = item.querySelector(".product-subnav");
            var subItems = subnav ? subnav.querySelectorAll(".product-subnav-item") : [];

            if (index === state.activeCategoryIndex) {
                item.classList.add("current");
            } else {
                item.classList.remove("current");
            }

            if (index === state.expandedCategoryIndex) {
                item.classList.add("expanded");
            } else {
                item.classList.remove("expanded");
            }

            // 添加active类到正确的子分类
            subItems.forEach(function(subItem, subIndex) {
                if (index === state.activeCategoryIndex && subIndex === state.activeSubcategoryIndex) {
                    subItem.classList.add("active");
                }
            });
        });
    }

    function loadProducts(url, updateHistory) {
        if (state.isLoading && currentRequest) {
            currentRequest.abort();
        }

        state.isLoading = true;
        showLoading();

        currentRequest = new XMLHttpRequest();
        currentRequest.open("GET", url, true);
        currentRequest.setRequestHeader("X-Requested-With", "XMLHttpRequest");

        currentRequest.onload = function() {
            if (currentRequest.status >= 200 && currentRequest.status < 400) {
                onProductsLoaded(currentRequest.responseText, updateHistory ? url : null);
            } else {
                onLoadError(url);
            }
        };

        currentRequest.onerror = function() {
            onLoadError(url);
        };

        currentRequest.send();
    }

    function onProductsLoaded(html, targetUrl) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, "text/html");

        var newProductList = doc.querySelector(".product-list");
        var newHeader = doc.querySelector(".product-list-header");
        var newPagination = doc.querySelector(".mod_page");

        // Update title and subtitle when category changes
        if (newHeader) {
            var currentHeader = document.querySelector(".product-list-header");
            if (currentHeader) {
                var newTitle = newHeader.querySelector("h1");
                var newSubtitle = newHeader.querySelector("#categorySubtitle");
                var currentTitle = currentHeader.querySelector("h1");
                var currentSubtitle = currentHeader.querySelector("#categorySubtitle");

                if (newTitle && currentTitle) {
                    currentTitle.textContent = newTitle.textContent;
                }
                if (newSubtitle && currentSubtitle) {
                    var newCategory = newSubtitle.getAttribute("data-category");
                    currentSubtitle.setAttribute("data-category", newCategory);
                    if (typeof updateCategorySubtitle === "function") {
                        updateCategorySubtitle();
                    }
                }
            }
        }

        if (elements.productList && newProductList) {
            elements.productList.innerHTML = newProductList.innerHTML;
            elements.productList.classList.remove("fade-out");
            elements.productList.classList.add("fade-in", "ajax-loaded");

            reinitLazyLoad();

            setTimeout(function() {
                elements.productList.classList.remove("fade-in", "ajax-loaded");
            }, 800);
        }

        if (elements.pagination) {
            if (newPagination) {
                elements.pagination.innerHTML = newPagination.innerHTML;
                elements.pagination.classList.remove("fade-out");
                elements.pagination.classList.add("fade-in");
                bindPaginationLinks();

                setTimeout(function() {
                    elements.pagination.classList.remove("fade-in");
                }, 500);
            } else {
                elements.pagination.innerHTML = "";
            }
        }

        if (targetUrl && window.history.pushState) {
            window.history.pushState({ path: targetUrl }, "", targetUrl);
        }

        updateUI();
        hideLoading();
        state.isLoading = false;
    }

    function onLoadError(url) {
        hideLoading();
        state.isLoading = false;
    }

    function showLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.add("active");
        }
        if (elements.productList) {
            elements.productList.classList.add("fade-out");
        }
        if (elements.pagination) {
            elements.pagination.classList.add("fade-out");
        }
    }

    function hideLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.remove("active");
        }
    }

    function reinitLazyLoad() {
        if (typeof LazyLoad !== "undefined") {
            new LazyLoad({ elements_selector: ".lazy" });
        }
        setTimeout(function() {
            window.dispatchEvent(new Event("scroll"));
        }, 100);
    }

    function bindPaginationLinks() {
        var links = document.querySelectorAll(".mod_page a");
        links.forEach(function(link) {
            link.addEventListener("click", function(e) {
                e.preventDefault();
                var url = this.getAttribute("href");
                if (url) {
                    loadProducts(url, true);
                }
            });
        });
    }

    function handlePopState() {
        window.addEventListener("popstate", function(e) {
            if (e.state && e.state.path) {
                window.location.href = e.state.path;
            }
        });
    }

    return {
        init: init,
        getState: function() { return state; }
    };
})();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
        window.ProductNav.init();
    });
} else {
    window.ProductNav.init();
}

// Fallback fix to ensure expanded class is added on initial page load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
        setTimeout(function() {
            var navItems = document.querySelectorAll(".product-nav-item");
            navItems.forEach(function(item, index) {
                if (item.classList.contains("current")) {
                    var subItems = item.querySelectorAll(".product-subnav-item");
                    if (subItems.length > 0) {
                        item.classList.add("expanded");
                    }
                }
            });
        }, 50);
    });
} else {
    setTimeout(function() {
        var navItems = document.querySelectorAll(".product-nav-item");
        navItems.forEach(function(item, index) {
            if (item.classList.contains("current")) {
                var subItems = item.querySelectorAll(".product-subnav-item");
                if (subItems.length > 0) {
                    item.classList.add("expanded");
                }
            }
        });
    }, 50);
}