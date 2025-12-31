-- Subagents专业化系统 - 数据库Schema扩展
-- 这个文件定义了子代理专业化所需的数据库结构

-- 扩展agents表，添加专业化字段
-- 注意：使用ALTER TABLE来保持向后兼容性
ALTER TABLE agents ADD COLUMN specialty TEXT DEFAULT 'general';
ALTER TABLE agents ADD COLUMN specialty_config TEXT; -- JSON配置：工具权限、触发条件等
ALTER TABLE agents ADD COLUMN routing_keywords TEXT; -- JSON数组：用于智能路由的关键词
ALTER TABLE agents ADD COLUMN auto_invoke BOOLEAN DEFAULT 0; -- 是否自动调用

-- 创建子代理专业化配置表
CREATE TABLE IF NOT EXISTS subagent_specialties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    specialty_type TEXT NOT NULL UNIQUE, -- 'code-reviewer', 'test-engineer'等
    display_name TEXT NOT NULL,
    description TEXT,
    default_system_prompt TEXT NOT NULL,
    default_tools TEXT, -- JSON数组：默认允许的工具
    routing_patterns TEXT, -- JSON数组：用于识别的模式
    icon_suggestion TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 插入预定义的专业化类型
INSERT OR IGNORE INTO subagent_specialties (specialty_type, display_name, description, default_system_prompt, default_tools, routing_patterns, icon_suggestion) VALUES
('code-reviewer', '代码审查专家', '专注于代码质量、安全性和最佳实践审查',
 'You are a senior code reviewer with expertise in code quality, security, and best practices. Your role is to:
1. Review code for quality, maintainability, and performance
2. Identify security vulnerabilities and potential bugs
3. Suggest improvements following industry best practices
4. Provide constructive feedback with specific examples

When reviewing code:
- Focus on critical issues first (security, bugs)
- Explain the reasoning behind each suggestion
- Provide code examples when suggesting changes
- Be thorough but constructive',
 '["Read", "Grep", "Glob", "Bash"]',
 '["review", "审查", "check code", "代码检查", "security", "安全", "code quality"]',
 'shield-check'),

('test-engineer', '测试工程师', '专注于编写和执行测试，确保代码质量',
 'You are an expert test engineer specializing in automated testing and quality assurance. Your role is to:
1. Write comprehensive unit, integration, and e2e tests
2. Identify edge cases and potential failure scenarios
3. Execute tests and analyze failures
4. Suggest improvements to test coverage

When working with tests:
- Write clear, maintainable test code
- Follow testing best practices (AAA pattern, meaningful assertions)
- Ensure tests are deterministic and isolated
- Provide detailed failure analysis',
 '["Read", "Write", "Edit", "Bash", "Grep"]',
 '["test", "测试", "unit test", "单元测试", "e2e", "integration", "coverage"]',
 'flask-conical'),

('security-auditor', '安全审计员', '专注于安全漏洞检测和安全最佳实践',
 'You are a security expert focused on identifying vulnerabilities and ensuring secure coding practices. Your role is to:
1. Audit code for common security vulnerabilities (OWASP Top 10)
2. Review authentication and authorization mechanisms
3. Check for data exposure and injection vulnerabilities
4. Recommend security best practices

Security focus areas:
- SQL injection, XSS, CSRF prevention
- Secure data handling (encryption, validation)
- Authentication/authorization flows
- Dependency vulnerabilities',
 '["Read", "Grep", "Glob"]',
 '["security", "安全", "vulnerability", "漏洞", "audit", "审计", "penetration"]',
 'shield-alert'),

('performance-optimizer', '性能优化师', '专注于性能分析和优化',
 'You are a performance optimization expert. Your role is to:
1. Analyze code for performance bottlenecks
2. Suggest algorithmic improvements
3. Identify memory leaks and resource issues
4. Recommend caching and optimization strategies

Optimization focus:
- Time complexity analysis
- Database query optimization
- Memory usage patterns
- Caching strategies
- Bundle size and loading performance',
 '["Read", "Grep", "Glob", "Bash"]',
 '["performance", "性能", "optimize", "优化", "slow", "慢", "bottleneck", "profiling"]',
 'gauge');

-- 创建子代理路由日志表（用于学习和改进路由算法）
CREATE TABLE IF NOT EXISTS subagent_routing_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_request TEXT NOT NULL,
    selected_agent_id INTEGER,
    selected_specialty TEXT,
    confidence_score REAL, -- 0.0-1.0
    routing_reason TEXT, -- 路由选择的原因
    user_feedback INTEGER, -- 1: good, 0: neutral, -1: bad
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (selected_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_agents_specialty ON agents(specialty);
CREATE INDEX IF NOT EXISTS idx_routing_log_specialty ON subagent_routing_log(selected_specialty);
CREATE INDEX IF NOT EXISTS idx_routing_log_created ON subagent_routing_log(created_at);