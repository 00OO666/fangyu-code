/**
 * useLatest - 稳定回调引用 Hook
 * 
 * 用于在 useEffect 中使用回调函数时，避免将回调加入依赖数组
 * 这样可以防止不必要的重渲染和 effect 重新执行
 * 
 * @example
 * ```tsx
 * function SearchInput({ onSearch }) {
 *   const [query, setQuery] = useState('');
 *   const onSearchRef = useLatest(onSearch);
 * 
 *   useEffect(() => {
 *     const timeout = setTimeout(() => onSearchRef.current(query), 300);
 *     return () => clearTimeout(timeout);
 *   }, [query]); // onSearch 不在依赖中，但总是使用最新值
 * }
 * ```
 */

import { useRef, useEffect } from 'react';

/**
 * 返回一个 ref，其 .current 总是指向最新的值
 * 适用于在 useEffect/useCallback 中使用回调函数
 */
export function useLatest<T>(value: T) {
    const ref = useRef(value);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref;
}

/**
 * 返回一个稳定的回调函数，内部总是调用最新的回调
 * 适用于传递给子组件的回调 props
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
    const callbackRef = useLatest(callback);

    // 使用 useRef 创建稳定的函数引用
    const stableRef = useRef<T>();

    if (!stableRef.current) {
        stableRef.current = ((...args: Parameters<T>) => {
            return callbackRef.current(...args);
        }) as T;
    }

    return stableRef.current;
}

export default useLatest;
