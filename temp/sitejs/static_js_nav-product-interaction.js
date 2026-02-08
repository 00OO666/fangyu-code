/**
 * 产品导航菜单交互脚本 - 缩小版卡片
 * 功能: 鼠标悬停左侧分类时,右侧显示对应的产品列表
 */

document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.hsm-content .pro-xl-list .list-name1>li');
    const displayContainer = document.querySelector('.nav-products-display');
    
    if (!navItems.length || !displayContainer) return;
    
    // 设置容器样式
    displayContainer.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        width: calc(100% - 320px);
        height: 100%;
        padding: 40px 50px;
        background: transparent;
        overflow-y: auto;
        z-index: 5;
    `;
    
    // 设置父容器为 position: relative
    const containerParent = displayContainer.parentElement;
    if (containerParent) {
        containerParent.style.position = 'relative';
    }
    
    // 函数：将产品列表转换为缩小版网格
    function generateCompactProductGrid(listIntro) {
        const ul = listIntro.querySelector('.row.g-5');
        if (!ul) return '';
        
        // 创建新的网格容器
        const compactGrid = document.createElement('ul');
        compactGrid.className = 'row g-5';
        
        // 复制所有产品项
        const liItems = ul.querySelectorAll('li');
        liItems.forEach(function(li) {
            const clonedLi = li.cloneNode(true);
            compactGrid.appendChild(clonedLi);
        });
        
        return compactGrid.outerHTML;
    }
    
    // 默认显示第一个分类的产品
    const firstListIntro = navItems[0].querySelector('.list-intro');
    if (firstListIntro) {
        const compactHTML = generateCompactProductGrid(firstListIntro);
        displayContainer.innerHTML = compactHTML;
    }
    
    // 为每个分类项添加悬停事件
    navItems.forEach(function(item) {
        item.addEventListener('mouseenter', function() {
            const listIntro = item.querySelector('.list-intro');
            if (listIntro) {
                const compactHTML = generateCompactProductGrid(listIntro);
                displayContainer.innerHTML = compactHTML;
                
                // 重新绑定图片懒加载（如果需要）
                if (window.lazyLoadInstances) {
                    window.lazyLoadInstances.forEach(function(instance) {
                        instance.update();
                    });
                }
            }
            
            // 更新分类项的 active 状态
            navItems.forEach(function(nav) {
                nav.classList.remove('active');
            });
            item.classList.add('active');
        });
    });
    
    // 鼠标离开菜单时保持显示
    const proXlList = document.querySelector('.hsm-content .pro-xl-list');
    if (proXlList) {
        proXlList.addEventListener('mouseleave', function() {
            // 保持当前显示
        });
    }
});
