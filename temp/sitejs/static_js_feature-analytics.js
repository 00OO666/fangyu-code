/**
 * 高级用户行为分析系统 v2.0
 * 功能：页面访问、流量来源、设备分析、停留时间、用户路径、询盘转化
 */

(function() {
    var Analytics = {
        config: { api: '/api-analytics.php', hb: 30000 },
        sid: '',
        uid: '',
        start: Date.now(),
        scrolled: {},

        init: function() {
            this.sid = this.getSess();
            this.uid = this.getUser();
            this.scrolled = { 25: false, 50: false, 75: false, 100: false };
            this.setup();
            this.pv();
            this.hb();
            console.log('[Analytics] v2.0 init');
        },

        getSess: function() {
            var k = 'fa_s', ek = 'fa_se', now = Date.now();
            var exp = localStorage.getItem(ek);
            if (exp && now < parseInt(exp)) {
                localStorage.setItem(ek, now + 1800000);
                return localStorage.getItem(k);
            }
            var id = 's_' + now + '_' + Math.random().toString(36).substr(2, 6);
            localStorage.setItem(k, id);
            localStorage.setItem(ek, now + 1800000);
            return id;
        },

        getUser: function() {
            var k = 'fa_u', id = localStorage.getItem(k);
            if (!id) {
                id = 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                localStorage.setItem(k, id);
            }
            return id;
        },

        dev: function() {
            var ua = navigator.userAgent;
            var t = 'desktop', os = 'Unknown', br = 'Other';
            if (/Mobile|Android|iPhone|iPad/i.test(ua)) t = /iPad|Tablet/i.test(ua) ? 'tablet' : 'mobile';
            if (/Windows/i.test(ua)) os = 'Windows';
            else if (/Mac/i.test(ua)) os = 'MacOS';
            else if (/Android/i.test(ua)) os = 'Android';
            else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
            else if (/Linux/i.test(ua)) os = 'Linux';
            if (/Edg/i.test(ua)) br = 'Edge';
            else if (/Chrome/i.test(ua)) br = 'Chrome';
            else if (/Firefox/i.test(ua)) br = 'Firefox';
            else if (/Safari/i.test(ua)) br = 'Safari';
            return { type: t, os: os, browser: br, screen: screen.width + 'x' + screen.height, lang: navigator.language };
        },

        src: function() {
            var ref = document.referrer, type = 'direct', dom = '';
            try {
                var u = new URL(location.href);
                var utm = { s: u.searchParams.get('utm_source'), m: u.searchParams.get('utm_medium') };
                if (ref) {
                    var r = new URL(ref);
                    dom = r.hostname;
                    if (r.hostname === location.hostname) type = 'internal';
                    else if (/google|bing|yahoo|baidu|sogou|yandex/i.test(dom)) type = 'organic';
                    else if (/facebook|twitter|linkedin|youtube|instagram/i.test(dom)) type = 'social';
                    else type = 'referral';
                }
                if (utm.s) type = utm.m || 'campaign';
            } catch(e) {}
            return { type: type, ref: ref || '(direct)', domain: dom || '(direct)' };
        },

        pg: function() {
            var p = location.pathname, t = 'other';
            if (p === '/' || p === '/index.html') t = 'home';
            else if (/products?_/i.test(p)) t = 'product';
            else if (/news_/i.test(p)) t = 'news';
            else if (/about|company/i.test(p)) t = 'about';
            else if (/contact/i.test(p)) t = 'contact';
            return { url: location.href, path: p, title: document.title, type: t };
        },

        send: function(name, data) {
            var payload = {
                event_name: name,
                event_data: data || {},
                session_id: this.sid,
                user_id: this.uid,
                page: this.pg(),
                device: this.dev(),
                source: this.src(),
                ts: new Date().toISOString()
            };
            fetch(this.config.api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function() {});
        },

        pv: function() {
            var k = 'fa_p_' + this.sid;
            var h = JSON.parse(sessionStorage.getItem(k) || '[]');
            h.push({ p: location.pathname, t: document.title, tm: Date.now() });
            if (h.length > 20) h = h.slice(-20);
            sessionStorage.setItem(k, JSON.stringify(h));
            this.send('page_view', { path_index: h.length, is_landing: h.length === 1 });
        },

        setup: function() {
            var self = this, st;

            window.addEventListener('scroll', function() {
                clearTimeout(st);
                st = setTimeout(function() {
                    var pct = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
                    [25, 50, 75, 100].forEach(function(m) {
                        if (pct >= m && !self.scrolled[m]) {
                            self.scrolled[m] = true;
                            self.send('scroll_depth', { depth: m });
                        }
                    });
                }, 200);
            });

            document.addEventListener('click', function(e) {
                var a = e.target.closest('a');
                if (a && a.href) {
                    self.send('link_click', { url: a.href, text: (a.innerText || '').substr(0, 50) });
                    if (/wa\.me|whatsapp/i.test(a.href)) self.send('cta_click', { type: 'whatsapp' });
                    else if (/^mailto:/i.test(a.href)) self.send('cta_click', { type: 'email' });
                    else if (/^tel:/i.test(a.href)) self.send('cta_click', { type: 'phone' });
                }
            });

            document.addEventListener('submit', function(e) {
                self.send('form_submit', { form_id: e.target.id || 'unknown' });
            });

            window.addEventListener('beforeunload', function() {
                var d = Math.round((Date.now() - self.start) / 1000);
                self.send('time_on_page', { duration: d });
            });
        },

        hb: function() {
            var self = this;
            setInterval(function() {
                if (!document.hidden) {
                    self.send('heartbeat', { duration: Math.round((Date.now() - self.start) / 1000) });
                }
            }, self.config.hb);
        },

        track: function(name, data) { this.send(name, data); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { Analytics.init(); });
    } else {
        Analytics.init();
    }

    window.Analytics = Analytics;
})();
