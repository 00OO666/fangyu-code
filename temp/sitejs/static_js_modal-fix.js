// Modal click fix - prevent hidden modals from blocking clicks
(function () {
    var style = document.createElement('style');
    style.id = 'modal-click-fix';
    style.textContent = '.quote-modal,.quote-overlay,.ai-modal-overlay,.ai-modal{pointer-events:none!important}.quote-modal.active,.quote-overlay.active,.ai-modal-overlay.active,.ai-modal.active{pointer-events:auto!important}';
    document.head.appendChild(style);
})();
