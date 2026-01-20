/**
 * API Key 输入组件 - 支持掩码显示和剪贴板粘贴
 */

import { logger } from '@/lib/logger';
import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Clipboard, Check } from 'lucide-react';
import { maskApiKey } from '../../services/cryptoService';
import { cn } from '../../lib/utils';

interface ApiKeyInputProps {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
    placeholder?: string;
}

export function ApiKeyInput({
    value,
    onChange,
    error,
    disabled,
    placeholder = 'sk-...',
}: ApiKeyInputProps) {
    const [showKey, setShowKey] = useState(false);
    const [justPasted, setJustPasted] = useState(false);

    const displayValue = showKey ? value : (value ? maskApiKey(value) : '');

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                onChange(text.trim());
                setJustPasted(true);
                setTimeout(() => setJustPasted(false), 2000);
            }
        } catch (err) {
            logger.error('ApiKeyInput', '无法读取剪贴板:', err);
        }
    }, [onChange]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    const toggleShow = useCallback(() => {
        setShowKey(prev => !prev);
    }, []);

    return (
        <div className="relative">
            <input
                type={showKey ? 'text' : 'password'}
                value={showKey ? value : value}
                onChange={handleChange}
                disabled={disabled}
                placeholder={placeholder}
                autoComplete="off"
                className={cn(
                    'w-full px-3 py-2 pr-20 rounded-lg border text-sm',
                    'bg-white dark:bg-gray-800',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    'transition-colors duration-200',
                    error
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* 粘贴按钮 */}
                <button
                    type="button"
                    onClick={handlePaste}
                    disabled={disabled}
                    className={cn(
                        'p-1.5 rounded-md transition-colors',
                        'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        justPasted && 'text-green-500'
                    )}
                    title="从剪贴板粘贴"
                    aria-label="从剪贴板粘贴"
                >
                    {justPasted ? (
                        <Check className="w-4 h-4" />
                    ) : (
                        <Clipboard className="w-4 h-4" />
                    )}
                </button>

                {/* 显示/隐藏按钮 */}
                <button
                    type="button"
                    onClick={toggleShow}
                    disabled={disabled || !value}
                    className={cn(
                        'p-1.5 rounded-md transition-colors',
                        'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        (!value || disabled) && 'opacity-50 cursor-not-allowed'
                    )}
                    title={showKey ? '隐藏' : '显示'}
                    aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
                >
                    {showKey ? (
                        <EyeOff className="w-4 h-4" />
                    ) : (
                        <Eye className="w-4 h-4" />
                    )}
                </button>
            </div>

            {error && (
                <p className="mt-1 text-xs text-red-500">{error}</p>
            )}
        </div>
    );
}

export default ApiKeyInput;
