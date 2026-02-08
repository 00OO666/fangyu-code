/**
 * Category Showcase - 产品展示板块
 * 包含：粒子背景动画 + AI咨询功能
 */

(function() {
    'use strict';

    // ============ 粒子背景动画 ============
    function initParticleBackground() {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];
        const particleCount = 300;

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resize);
        resize();

        class StarParticle {
            constructor() {
                this.reset();
                this.y = Math.random() * height;
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.z = Math.random() * 1.4 + 0.1;
                this.size = Math.random() * 0.8 * this.z;
                if (this.size < 0.5) this.size = 0.5;
                this.vx = (Math.random() - 0.5) * 0.2 * this.z;
                this.vy = (Math.random() - 0.5) * 0.2 * this.z;

                if (Math.random() > 0.9) {
                    this.color = 'rgba(59, 130, 246,';
                    this.isBlue = true;
                    this.size *= 1.2;
                } else {
                    this.color = 'rgba(255, 255, 255,';
                    this.isBlue = false;
                }

                this.alpha = Math.random() * 0.3 + 0.1;
                this.alphaDir = Math.random() > 0.5 ? 1 : -1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.alpha += 0.003 * this.alphaDir;

                if (this.alpha >= 0.6) this.alphaDir = -1;
                else if (this.alpha <= 0.05) this.alphaDir = 1;

                if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
                    this.reset();
                }
            }

            draw() {
                ctx.fillStyle = this.color + this.alpha + ')';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();

                if (this.isBlue && this.alpha > 0.3) {
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new StarParticle());
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            requestAnimationFrame(animate);
        }

        animate();
    }

    // ============ AI 咨询功能 ============
    const apiKey = "AIzaSyAR07F-gCmP8jXCm4VmWYPAMnQ7P_Ky4C8";

    window.toggleAIModal = function() {
        const overlay = document.getElementById('aiOverlay');
        if (!overlay) return;

        const modal = overlay.querySelector('.ai-modal');

        if (overlay.style.display === 'flex') {
            overlay.style.opacity = '0';
            modal.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        } else {
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.style.opacity = '1';
                modal.classList.add('active');
            }, 10);
        }
    };

    window.askGemini = async function() {
        const query = document.getElementById('userQuery').value;
        if (!query) return;

        const resultDiv = document.getElementById('aiResult');
        const btn = document.querySelector('.ai-submit-btn');

        // UI Loading State
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = 'Thinking... <span style="animation: pulse-glow 1s infinite">✨</span>';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        const systemPrompt = `You are an expert industrial machinery consultant for FANGYU.
The available products are:
1. Press Brake (Bending)
2. Laser Cutting Machine (Cutting)
3. Rolling Machine (Cylindrical forming)
4. Shearing Machine (Cutting sheets)
5. Grooving Machine (V-grooving for decoration)
6. Industrial Robot (Automation)

User's need: ${query}

Recommend the ONE best machine from the list above.
Format your response exactly like this:
**Recommendation:** [Machine Name]
**Reason:** [Brief explanation in 2 sentences]
**Technical Tip:** [One technical specification to look for]`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: systemPrompt }]
                    }]
                })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            // Simple markdown parsing for bold
            const formattedText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');

            resultDiv.innerHTML = formattedText;
        } catch (error) {
            resultDiv.innerHTML = 'Sorry, I could not connect to the server. Please try again later.';
            console.error(error);
        } finally {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    };

    // 点击遮罩关闭Modal
    function initModalClose() {
        const overlay = document.getElementById('aiOverlay');
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === this) {
                    toggleAIModal();
                }
            });
        }
    }

    // ============ 产品卡片点击跳转 ============
    function initCategoryClickable() {
        // 让点击卡片的任意区域都能跳转到产品页
        const cards = document.querySelectorAll('.cat-card');
        
        cards.forEach(card => {
            const link = card.querySelector('.cat-btn');
            
            // 如果卡片有链接，整个卡片区域都可以点击跳转
            if (link) {
                card.style.cursor = 'pointer';
                
                card.addEventListener('click', function(e) {
                    // 如果点击的是按钮内的元素，防止双重触发
                    if (e.target.closest('.cat-btn')) {
                        e.stopPropagation();
                        return;
                    }
                    // 跳转到产品页
                    window.location.href = link.href;
                });
                
                // 鼠标悬停时的视觉反馈（可选）
                card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
                card.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-4px)';
                });
                card.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                });
            }
        });
    }

    // ============ 初始化 ============
    function init() {
        // 为首页body添加深色主题class
        if (document.querySelector('.category-section')) {
            document.body.classList.add('homepage-dark');
        }

        initParticleBackground();
        initModalClose();
        initCategoryClickable();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
