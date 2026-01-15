---
inclusion: manual
---

# React Best Practices - Vercel Engineering

> 来源: https://github.com/vercel-labs/agent-skills/tree/react-best-practices
> 版本: 0.1.0 (January 2026)

React 和 Next.js 性能优化指南，包含 40+ 条规则，按影响程度排序。

## 优先级概览

| 优先级 | 类别 | 影响 |
|--------|------|------|
| 1 | 消除瀑布流 | **CRITICAL** |
| 2 | Bundle 优化 | **CRITICAL** |
| 3 | 服务端性能 | HIGH |
| 4 | 客户端数据获取 | MEDIUM-HIGH |
| 5 | 重渲染优化 | MEDIUM |
| 6 | 渲染性能 | MEDIUM |
| 7 | JavaScript 性能 | LOW-MEDIUM |
| 8 | 高级模式 | LOW |

---

## 1. 消除瀑布流 (CRITICAL)

瀑布流是性能杀手 #1。每个顺序 await 都会增加完整的网络延迟。

### 1.1 延迟 await 到需要时

```typescript
// ❌ 错误: 阻塞两个分支
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  if (skipProcessing) return { skipped: true }
  return processUserData(userData)
}

// ✅ 正确: 只在需要时阻塞
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) return { skipped: true }
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

### 1.2 Promise.all() 并行执行

```typescript
// ❌ 错误: 顺序执行，3 次往返
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// ✅ 正确: 并行执行，1 次往返
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

### 1.3 Suspense 边界流式传输

```tsx
// ❌ 错误: 整个页面被数据获取阻塞
async function Page() {
  const data = await fetchData()
  return (
    <div>
      <Sidebar />
      <DataDisplay data={data} />
    </div>
  )
}

// ✅ 正确: 包装器立即显示，数据流式传入
function Page() {
  return (
    <div>
      <Sidebar />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />
      </Suspense>
    </div>
  )
}
```

---

## 2. Bundle 优化 (CRITICAL)

### 2.1 避免 Barrel 文件导入

```tsx
// ❌ 错误: 导入整个库 (1,583 模块, ~2.8s)
import { Check, X, Menu } from 'lucide-react'

// ✅ 正确: 只导入需要的 (3 模块, ~2KB)
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'

// ✅ 或使用 Next.js 13.5+ 配置
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@mui/material']
  }
}
```

常见受影响库: `lucide-react`, `@mui/material`, `@tabler/icons-react`, `react-icons`, `lodash`, `date-fns`

### 2.2 动态导入重型组件

```tsx
// ❌ 错误: Monaco 打包到主 chunk (~300KB)
import { MonacoEditor } from './monaco-editor'

// ✅ 正确: Monaco 按需加载
import dynamic from 'next/dynamic'
const MonacoEditor = dynamic(
  () => import('./monaco-editor').then(m => m.MonacoEditor),
  { ssr: false }
)
```

### 2.3 延迟非关键第三方库

```tsx
// ❌ 错误: 阻塞初始 bundle
import { Analytics } from '@vercel/analytics/react'

// ✅ 正确: hydration 后加载
import dynamic from 'next/dynamic'
const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)
```

### 2.4 基于用户意图预加载

```tsx
function EditorButton({ onClick }) {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void import('./monaco-editor')
    }
  }

  return (
    <button
      onMouseEnter={preload}
      onFocus={preload}
      onClick={onClick}
    >
      Open Editor
    </button>
  )
}
```

---

## 3. 服务端性能 (HIGH)

### 3.1 React.cache() 请求内去重

```typescript
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  return await db.user.findUnique({ where: { id: session.user.id } })
})
```

### 3.2 最小化 RSC 边界序列化

```tsx
// ❌ 错误: 序列化所有 50 个字段
async function Page() {
  const user = await fetchUser()  // 50 fields
  return <Profile user={user} />
}

// ✅ 正确: 只序列化 1 个字段
async function Page() {
  const user = await fetchUser()
  return <Profile name={user.name} />
}
```

### 3.3 组件组合并行数据获取

```tsx
// ❌ 错误: Sidebar 等待 Page 的 fetch 完成
export default async function Page() {
  const header = await fetchHeader()
  return (
    <div>
      <div>{header}</div>
      <Sidebar />
    </div>
  )
}

// ✅ 正确: 两者同时 fetch
async function Header() {
  const data = await fetchHeader()
  return <div>{data}</div>
}

export default function Page() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  )
}
```

---

## 4. 客户端数据获取 (MEDIUM-HIGH)

### 4.1 使用 SWR 自动去重

```tsx
// ❌ 错误: 无去重，每个实例都 fetch
function UserList() {
  const [users, setUsers] = useState([])
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers)
  }, [])
}

// ✅ 正确: 多个实例共享一个请求
import useSWR from 'swr'
function UserList() {
  const { data: users } = useSWR('/api/users', fetcher)
}
```

---

## 5. 重渲染优化 (MEDIUM)

### 5.1 延迟状态读取到使用点

```tsx
// ❌ 错误: 订阅所有 searchParams 变化
function ShareButton({ chatId }) {
  const searchParams = useSearchParams()
  const handleShare = () => {
    const ref = searchParams.get('ref')
    shareChat(chatId, { ref })
  }
  return <button onClick={handleShare}>Share</button>
}

// ✅ 正确: 按需读取，无订阅
function ShareButton({ chatId }) {
  const handleShare = () => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    shareChat(chatId, { ref })
  }
  return <button onClick={handleShare}>Share</button>
}
```

### 5.2 使用惰性状态初始化

```tsx
// ❌ 错误: 每次渲染都运行
const [searchIndex] = useState(buildSearchIndex(items))

// ✅ 正确: 只运行一次
const [searchIndex] = useState(() => buildSearchIndex(items))
```

### 5.3 使用 Transitions 处理非紧急更新

```tsx
import { startTransition } from 'react'

function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handler = () => {
      startTransition(() => setScrollY(window.scrollY))
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
}
```

---

## 6. 渲染性能 (MEDIUM)

### 6.1 动画 SVG 包装器而非 SVG 元素

```tsx
// ❌ 错误: 直接动画 SVG - 无硬件加速
<svg className="animate-spin">...</svg>

// ✅ 正确: 动画包装器 div - 硬件加速
<div className="animate-spin">
  <svg>...</svg>
</div>
```

### 6.2 CSS content-visibility 处理长列表

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

### 6.3 使用显式条件渲染

```tsx
// ❌ 错误: count 为 0 时渲染 "0"
{count && <span>{count}</span>}

// ✅ 正确: count 为 0 时不渲染
{count > 0 ? <span>{count}</span> : null}
```

---

## 7. JavaScript 性能 (LOW-MEDIUM)

### 7.1 批量 DOM CSS 更改

```typescript
// ❌ 错误: 多次 reflow
element.style.width = '100px'
element.style.height = '200px'

// ✅ 正确: 单次 reflow
element.classList.add('highlighted-box')
// 或
element.style.cssText = 'width: 100px; height: 200px;'
```

### 7.2 构建索引 Map 用于重复查找

```typescript
// ❌ 错误: O(n) 每次查找
orders.map(order => ({
  ...order,
  user: users.find(u => u.id === order.userId)
}))

// ✅ 正确: O(1) 每次查找
const userById = new Map(users.map(u => [u.id, u]))
orders.map(order => ({
  ...order,
  user: userById.get(order.userId)
}))
```

### 7.3 使用 Set/Map 进行 O(1) 查找

```typescript
// ❌ 错误: O(n) 每次检查
const allowedIds = ['a', 'b', 'c']
items.filter(item => allowedIds.includes(item.id))

// ✅ 正确: O(1) 每次检查
const allowedIds = new Set(['a', 'b', 'c'])
items.filter(item => allowedIds.has(item.id))
```

### 7.4 使用 toSorted() 而非 sort()

```typescript
// ❌ 错误: 修改原数组
const sorted = users.sort((a, b) => a.name.localeCompare(b.name))

// ✅ 正确: 创建新数组
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name))
```

### 7.5 缓存 Storage API 调用

```typescript
const storageCache = new Map<string, string | null>()

function getLocalStorage(key: string) {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key))
  }
  return storageCache.get(key)
}
```

---

## 8. 高级模式 (LOW)

### 8.1 useLatest 稳定回调引用

```typescript
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => { ref.current = value }, [value])
  return ref
}

// 使用
function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('')
  const onSearchRef = useLatest(onSearch)

  useEffect(() => {
    const timeout = setTimeout(() => onSearchRef.current(query), 300)
    return () => clearTimeout(timeout)
  }, [query])  // onSearch 不在依赖中
}
```

---

## 参考链接

- https://react.dev
- https://nextjs.org
- https://swr.vercel.app
- https://github.com/shuding/better-all
- https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
- https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast
