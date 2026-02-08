/**
 * SkillsPanel - Skills 管理面板
 * 
 * 显示和管理已加载的 Skills
 */

import React, { useState, useMemo } from 'react';
import { Sparkles, Search, RefreshCw, ChevronRight, Workflow, ListTodo, BookOpen, Tag, Zap } from 'lucide-react';
import { useSkills } from '../../hooks/useSkills';
import type { Skill, SkillMode } from '../../core/skills';

// ============================================
// 类型
// ============================================

interface SkillsPanelProps {
  projectPath?: string;
  onSkillSelect?: (skill: Skill) => void;
  onSkillActivate?: (skill: Skill, prompt: string) => void;
}

// ============================================
// 辅助组件
// ============================================

const ModeIcon: React.FC<{ mode: SkillMode }> = ({ mode }) => {
  switch (mode) {
    case 'workflow':
      return <Workflow className="w-4 h-4 text-blue-400" />;
    case 'task':
      return <ListTodo className="w-4 h-4 text-green-400" />;
    case 'reference':
      return <BookOpen className="w-4 h-4 text-purple-400" />;
    default:
      return <Sparkles className="w-4 h-4 text-gray-400" />;
  }
};

const SkillCard: React.FC<{
  skill: Skill;
  onSelect: () => void;
  onActivate: () => void;
}> = ({ skill, onSelect, onActivate }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#1e1e1e] rounded-lg border border-[#333] hover:border-[#555] transition-colors">
      {/* 头部 */}
      <div 
        className="p-3 cursor-pointer flex items-center gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <ModeIcon mode={skill.mode} />
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-white truncate">
            {skill.metadata.name}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {skill.metadata.description}
          </div>
        </div>

        <ChevronRight 
          className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-[#333]">
          {/* 触发词 */}
          {skill.metadata.triggers && skill.metadata.triggers.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                触发词
              </div>
              <div className="flex flex-wrap gap-1">
                {skill.metadata.triggers.slice(0, 5).map((trigger, i) => (
                  <span 
                    key={i}
                    className="px-2 py-0.5 bg-[#2a2a2a] rounded text-xs text-gray-300"
                  >
                    {trigger}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 关键词 */}
          {skill.metadata.keywords && skill.metadata.keywords.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                关键词
              </div>
              <div className="flex flex-wrap gap-1">
                {skill.metadata.keywords.slice(0, 5).map((keyword, i) => (
                  <span 
                    key={i}
                    className="px-2 py-0.5 bg-blue-500/20 rounded text-xs text-blue-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 概述 */}
          <div className="mt-2">
            <div className="text-xs text-gray-400 line-clamp-3">
              {skill.overview}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="flex-1 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] rounded text-xs text-gray-300 transition-colors"
            >
              查看详情
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition-colors"
            >
              激活使用
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// 主组件
// ============================================

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  projectPath,
  onSkillSelect,
  onSkillActivate
}) => {
  const { skills, loading, error, refresh, generatePrompt, stats } = useSkills(projectPath);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<SkillMode | 'all'>('all');

  // 过滤 Skills
  const filteredSkills = useMemo(() => {
    let result = skills;

    // 按模式过滤
    if (filterMode !== 'all') {
      result = result.filter(s => s.mode === filterMode);
    }

    // 按搜索词过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.metadata.name.toLowerCase().includes(query) ||
        s.metadata.description.toLowerCase().includes(query) ||
        s.metadata.keywords?.some(k => k.toLowerCase().includes(query)) ||
        s.metadata.triggers?.some(t => t.toLowerCase().includes(query))
      );
    }

    return result;
  }, [skills, filterMode, searchQuery]);

  const handleActivate = (skill: Skill) => {
    const prompt = generatePrompt(skill);
    onSkillActivate?.(skill, prompt);
  };

  return (
    <div className="h-full flex flex-col bg-[#181818]">
      {/* 头部 */}
      <div className="p-3 border-b border-[#333]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="font-medium text-white">Skills</span>
            <span className="text-xs text-gray-500">({stats.total})</span>
          </div>
          
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 hover:bg-[#333] rounded transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索 Skills..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#252525] border border-[#333] rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 模式过滤 */}
        <div className="flex gap-1 mt-2">
          {(['all', 'workflow', 'task', 'reference'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filterMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#252525] text-gray-400 hover:bg-[#333]'
              }`}
            >
              {mode === 'all' ? '全部' : mode}
              {mode !== 'all' && stats.byMode[mode] && (
                <span className="ml-1 opacity-60">({stats.byMode[mode]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Skills 列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && skills.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            加载中...
          </div>
        )}

        {!loading && filteredSkills.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? '没有找到匹配的 Skills' : '暂无 Skills'}
            <div className="text-xs mt-2">
              Skills 目录: ~/.fangyu-code/skills/
            </div>
          </div>
        )}

        {filteredSkills.map(skill => (
          <SkillCard
            key={skill.metadata.name}
            skill={skill}
            onSelect={() => onSkillSelect?.(skill)}
            onActivate={() => handleActivate(skill)}
          />
        ))}
      </div>

      {/* 底部提示 */}
      <div className="p-2 border-t border-[#333] text-xs text-gray-500 text-center">
        输入触发词自动匹配 Skill
      </div>
    </div>
  );
};

export default SkillsPanel;
