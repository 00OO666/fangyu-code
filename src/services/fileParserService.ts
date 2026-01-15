/**
 * File Parser Service - 多模态文件解析服务
 * 
 * 支持解析图片、PDF、Word、PPT、Excel 等文件
 * 将文件内容转换为 AI 可理解的格式
 * 
 * 🏗️ 性能优化 (v2.7.6):
 * - 使用动态导入延迟加载重型依赖 (pdfjs-dist, mammoth, xlsx)
 * - 减少初始 Bundle 大小约 500KB+
 * - 按需加载，只在实际解析文件时才加载对应库
 * 
 * _Requirements: 3.6 (代码分割)_
 */

// =============================================================================
// 类型定义
// =============================================================================

export type SupportedFileType =
    | 'image'
    | 'pdf'
    | 'word'
    | 'excel'
    | 'powerpoint'
    | 'text'
    | 'unknown';

export interface ParsedFile {
    type: SupportedFileType;
    name: string;
    size: number;
    mimeType: string;
    /** 文本内容（用于文档类型） */
    textContent?: string;
    /** Base64 图片数据（用于图片类型） */
    imageData?: string;
    /** 提取的图片列表（用于 PDF/PPT） */
    extractedImages?: Array<{ data: string; mimeType: string }>;
    /** 表格数据（用于 Excel） */
    tables?: Array<{ name: string; data: string[][] }>;
    /** 页数（用于 PDF） */
    pageCount?: number;
    /** 解析错误 */
    error?: string;
}

export interface FileParseOptions {
    /** 最大文本长度（超过会截断） */
    maxTextLength?: number;
    /** 是否提取图片 */
    extractImages?: boolean;
    /** PDF 最大页数 */
    maxPdfPages?: number;
}

// =============================================================================
// 动态导入缓存（避免重复加载）
// =============================================================================

let pdfjsLibCache: typeof import('pdfjs-dist') | null = null;
let mammothCache: typeof import('mammoth') | null = null;
let xlsxCache: typeof import('xlsx') | null = null;

/**
 * 动态加载 PDF.js 库
 */
async function loadPdfjs() {
    if (!pdfjsLibCache) {
        pdfjsLibCache = await import('pdfjs-dist');
        // 配置 PDF.js worker
        pdfjsLibCache.GlobalWorkerOptions.workerSrc =
            `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLibCache.version}/pdf.worker.min.js`;
    }
    return pdfjsLibCache;
}

/**
 * 动态加载 Mammoth 库
 */
async function loadMammoth() {
    if (!mammothCache) {
        const module = await import('mammoth');
        mammothCache = module.default || module;
    }
    return mammothCache;
}

/**
 * 动态加载 XLSX 库
 */
async function loadXlsx() {
    if (!xlsxCache) {
        xlsxCache = await import('xlsx');
    }
    return xlsxCache;
}

// =============================================================================
// 文件类型检测
// =============================================================================

const MIME_TYPE_MAP: Record<string, SupportedFileType> = {
    // 图片
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'image/svg+xml': 'image',
    'image/bmp': 'image',
    // PDF
    'application/pdf': 'pdf',
    // Word
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
    'application/msword': 'word',
    // Excel
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
    'application/vnd.ms-excel': 'excel',
    'text/csv': 'excel',
    // PowerPoint
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
    'application/vnd.ms-powerpoint': 'powerpoint',
    // 文本
    'text/plain': 'text',
    'text/markdown': 'text',
    'text/html': 'text',
    'application/json': 'text',
    'application/xml': 'text',
    'text/xml': 'text',
    'text/css': 'text',
    'text/javascript': 'text',
    'application/javascript': 'text',
};

/**
 * 检测文件类型
 */
export function detectFileType(file: File): SupportedFileType {
    // 先通过 MIME 类型判断
    if (MIME_TYPE_MAP[file.type]) {
        return MIME_TYPE_MAP[file.type];
    }

    // 通过扩展名判断
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
        case 'svg':
        case 'bmp':
            return 'image';
        case 'pdf':
            return 'pdf';
        case 'doc':
        case 'docx':
            return 'word';
        case 'xls':
        case 'xlsx':
        case 'csv':
            return 'excel';
        case 'ppt':
        case 'pptx':
            return 'powerpoint';
        case 'txt':
        case 'md':
        case 'json':
        case 'xml':
        case 'html':
        case 'css':
        case 'js':
        case 'ts':
        case 'tsx':
        case 'jsx':
        case 'py':
        case 'java':
        case 'c':
        case 'cpp':
        case 'h':
        case 'rs':
        case 'go':
        case 'rb':
        case 'php':
        case 'sql':
        case 'sh':
        case 'yaml':
        case 'yml':
        case 'toml':
        case 'ini':
        case 'conf':
        case 'log':
            return 'text';
        default:
            return 'unknown';
    }
}

/**
 * 检查文件是否支持
 */
export function isFileSupported(file: File): boolean {
    return detectFileType(file) !== 'unknown';
}


// =============================================================================
// 解析器实现
// =============================================================================

/**
 * 解析图片文件
 */
async function parseImage(file: File): Promise<ParsedFile> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve({
                type: 'image',
                name: file.name,
                size: file.size,
                mimeType: file.type,
                imageData: base64,
            });
        };
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
    });
}

/**
 * 解析 PDF 文件
 * 🏗️ 性能优化: 动态导入 pdfjs-dist (~200KB)
 */
async function parsePDF(file: File, options: FileParseOptions = {}): Promise<ParsedFile> {
    const maxPages = options.maxPdfPages || 50;
    const extractImages = options.extractImages ?? false;

    try {
        // 动态加载 PDF.js
        const pdfjsLib = await loadPdfjs();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageCount = Math.min(pdf.numPages, maxPages);

        const textParts: string[] = [];
        const extractedImages: Array<{ data: string; mimeType: string }> = [];

        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item) => ('str' in item ? item.str : ''))
                .join(' ');
            textParts.push(`--- 第 ${i} 页 ---\n${pageText}`);

            // 提取图片（可选）
            if (extractImages) {
                try {
                    const operatorList = await page.getOperatorList();
                    for (let j = 0; j < operatorList.fnArray.length; j++) {
                        if (operatorList.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
                            // 图片提取逻辑（简化版，实际可能需要更复杂的处理）
                            // 这里只是标记有图片，完整提取需要更多代码
                        }
                    }
                } catch {
                    // 忽略图片提取错误
                }
            }
        }

        let textContent = textParts.join('\n\n');
        if (options.maxTextLength && textContent.length > options.maxTextLength) {
            textContent = textContent.slice(0, options.maxTextLength) + '\n\n[内容已截断...]';
        }

        return {
            type: 'pdf',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            textContent,
            pageCount: pdf.numPages,
            extractedImages: extractedImages.length > 0 ? extractedImages : undefined,
        };
    } catch (error) {
        return {
            type: 'pdf',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            error: error instanceof Error ? error.message : 'PDF 解析失败',
        };
    }
}

/**
 * 解析 Word 文件
 * 🏗️ 性能优化: 动态导入 mammoth (~100KB)
 */
async function parseWord(file: File, options: FileParseOptions = {}): Promise<ParsedFile> {
    try {
        // 动态加载 Mammoth
        const mammoth = await loadMammoth();

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });

        let textContent = result.value;
        if (options.maxTextLength && textContent.length > options.maxTextLength) {
            textContent = textContent.slice(0, options.maxTextLength) + '\n\n[内容已截断...]';
        }

        return {
            type: 'word',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            textContent,
        };
    } catch (error) {
        return {
            type: 'word',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            error: error instanceof Error ? error.message : 'Word 文档解析失败',
        };
    }
}

/**
 * 解析 Excel 文件
 * 🏗️ 性能优化: 动态导入 xlsx (~200KB)
 */
async function parseExcel(file: File, options: FileParseOptions = {}): Promise<ParsedFile> {
    try {
        // 动态加载 XLSX
        const XLSX = await loadXlsx();

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const tables: Array<{ name: string; data: string[][] }> = [];
        const textParts: string[] = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

            tables.push({ name: sheetName, data: data as string[][] });

            // 转换为 Markdown 表格
            if (data.length > 0) {
                const mdTable = convertToMarkdownTable(data as string[][]);
                textParts.push(`### ${sheetName}\n\n${mdTable}`);
            }
        }

        let textContent = textParts.join('\n\n');
        if (options.maxTextLength && textContent.length > options.maxTextLength) {
            textContent = textContent.slice(0, options.maxTextLength) + '\n\n[内容已截断...]';
        }

        return {
            type: 'excel',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            textContent,
            tables,
        };
    } catch (error) {
        return {
            type: 'excel',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            error: error instanceof Error ? error.message : 'Excel 文件解析失败',
        };
    }
}

/**
 * 将二维数组转换为 Markdown 表格
 */
function convertToMarkdownTable(data: string[][]): string {
    if (data.length === 0) return '';

    const maxRows = 100; // 限制行数
    const rows = data.slice(0, maxRows);

    const lines: string[] = [];

    // 表头
    const header = rows[0] || [];
    lines.push('| ' + header.map(cell => String(cell || '')).join(' | ') + ' |');
    lines.push('| ' + header.map(() => '---').join(' | ') + ' |');

    // 数据行
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        lines.push('| ' + row.map(cell => String(cell || '')).join(' | ') + ' |');
    }

    if (data.length > maxRows) {
        lines.push(`\n*（仅显示前 ${maxRows} 行，共 ${data.length} 行）*`);
    }

    return lines.join('\n');
}


/**
 * 解析 PowerPoint 文件（简化版，提取文本）
 */
async function parsePowerPoint(file: File, options: FileParseOptions = {}): Promise<ParsedFile> {
    try {
        // PPTX 是 ZIP 格式，包含 XML 文件
        // 这里使用简化的方法：通过 JSZip 解析（如果需要完整支持）
        // 目前返回提示信息

        // 尝试使用 mammoth 的方式（可能不完全支持）
        const arrayBuffer = await file.arrayBuffer();

        // 简单的 PPTX 文本提取（基于 ZIP 结构）
        const textContent = await extractPptxText(arrayBuffer);

        let content = textContent || '（PPT 文件，建议导出为 PDF 后上传以获得更好的解析效果）';
        if (options.maxTextLength && content.length > options.maxTextLength) {
            content = content.slice(0, options.maxTextLength) + '\n\n[内容已截断...]';
        }

        return {
            type: 'powerpoint',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            textContent: content,
        };
    } catch (error) {
        return {
            type: 'powerpoint',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            textContent: '（PPT 文件解析受限，建议导出为 PDF 后上传）',
            error: error instanceof Error ? error.message : 'PPT 解析失败',
        };
    }
}

/**
 * 从 PPTX 文件提取文本（简化版）
 */
async function extractPptxText(arrayBuffer: ArrayBuffer): Promise<string> {
    // PPTX 是 ZIP 格式，这里使用简化的方法
    // 完整实现需要 JSZip 库

    try {
        // 尝试将其作为文本读取（不会成功，但作为 fallback）
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(arrayBuffer);

        // 尝试提取可见文本（非常简化）
        const textMatches = text.match(/<a:t>([^<]+)<\/a:t>/g);
        if (textMatches) {
            return textMatches
                .map(match => match.replace(/<\/?a:t>/g, ''))
                .filter(t => t.trim())
                .join('\n');
        }

        return '';
    } catch {
        return '';
    }
}

/**
 * 解析文本文件
 */
async function parseText(file: File, options: FileParseOptions = {}): Promise<ParsedFile> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            let textContent = reader.result as string;
            if (options.maxTextLength && textContent.length > options.maxTextLength) {
                textContent = textContent.slice(0, options.maxTextLength) + '\n\n[内容已截断...]';
            }
            resolve({
                type: 'text',
                name: file.name,
                size: file.size,
                mimeType: file.type || 'text/plain',
                textContent,
            });
        };
        reader.onerror = () => reject(new Error('读取文本文件失败'));
        reader.readAsText(file);
    });
}

// =============================================================================
// 主解析函数
// =============================================================================

/**
 * 解析文件
 */
export async function parseFile(file: File, options: FileParseOptions = {}): Promise<ParsedFile> {
    const fileType = detectFileType(file);

    switch (fileType) {
        case 'image':
            return parseImage(file);
        case 'pdf':
            return parsePDF(file, options);
        case 'word':
            return parseWord(file, options);
        case 'excel':
            return parseExcel(file, options);
        case 'powerpoint':
            return parsePowerPoint(file, options);
        case 'text':
            return parseText(file, options);
        default:
            return {
                type: 'unknown',
                name: file.name,
                size: file.size,
                mimeType: file.type,
                error: '不支持的文件类型',
            };
    }
}

/**
 * 批量解析文件
 */
export async function parseFiles(
    files: File[],
    options: FileParseOptions = {}
): Promise<ParsedFile[]> {
    return Promise.all(files.map(file => parseFile(file, options)));
}

/**
 * 将解析结果转换为 AI 消息内容
 */
export function parsedFileToAIContent(
    parsed: ParsedFile
): { type: 'text'; content: string } | { type: 'image'; data: string; mimeType: string } | null {
    if (parsed.error) {
        return {
            type: 'text',
            content: `[文件: ${parsed.name}] 解析失败: ${parsed.error}`,
        };
    }

    if (parsed.type === 'image' && parsed.imageData) {
        return {
            type: 'image',
            data: parsed.imageData,
            mimeType: parsed.mimeType,
        };
    }

    if (parsed.textContent) {
        return {
            type: 'text',
            content: `[文件: ${parsed.name}]\n\n${parsed.textContent}`,
        };
    }

    return null;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 获取文件类型图标
 */
export function getFileTypeIcon(type: SupportedFileType): string {
    switch (type) {
        case 'image':
            return '🖼️';
        case 'pdf':
            return '📄';
        case 'word':
            return '📝';
        case 'excel':
            return '📊';
        case 'powerpoint':
            return '📽️';
        case 'text':
            return '📃';
        default:
            return '📁';
    }
}

/**
 * 获取支持的文件扩展名列表
 */
export function getSupportedExtensions(): string[] {
    return [
        // 图片
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
        // 文档
        '.pdf', '.doc', '.docx',
        // 表格
        '.xls', '.xlsx', '.csv',
        // 演示
        '.ppt', '.pptx',
        // 文本
        '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.tsx', '.jsx',
        '.py', '.java', '.c', '.cpp', '.h', '.rs', '.go', '.rb', '.php', '.sql',
        '.sh', '.yaml', '.yml', '.toml', '.ini', '.conf', '.log',
    ];
}

/**
 * 预加载文件解析库（可选，用于提前加载）
 * 可在用户悬停在文件上传按钮时调用
 */
export async function preloadParsers(types: SupportedFileType[]): Promise<void> {
    const loaders: Promise<unknown>[] = [];

    if (types.includes('pdf')) {
        loaders.push(loadPdfjs());
    }
    if (types.includes('word')) {
        loaders.push(loadMammoth());
    }
    if (types.includes('excel')) {
        loaders.push(loadXlsx());
    }

    await Promise.all(loaders);
}

export default {
    parseFile,
    parseFiles,
    detectFileType,
    isFileSupported,
    parsedFileToAIContent,
    formatFileSize,
    getFileTypeIcon,
    getSupportedExtensions,
    preloadParsers,
};
