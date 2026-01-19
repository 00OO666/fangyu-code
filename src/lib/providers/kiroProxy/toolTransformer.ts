/**
 * Tool Transformer - 将 Anthropic tools 定义转换为 XML prompt
 */

import type { ToolDefinition, PropertySchema } from './types';

/**
 * 序列化参数 schema 为可读格式
 */
function serializeSchema(schema: PropertySchema, indent: string = ''): string {
  const lines: string[] = [];
  
  if (schema.type === 'object' && schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(key) ? ', required' : '';
      const desc = prop.description ? `: ${prop.description}` : '';
      lines.push(`${indent}- ${key} (${prop.type}${required})${desc}`);
      
      if (prop.type === 'object' && prop.properties) {
        lines.push(serializeSchema(prop, indent + '  '));
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * 生成工具的 XML 使用示例
 */
function generateUsageExample(tool: ToolDefinition): string {
  const params: string[] = [];
  
  if (tool.input_schema.properties) {
    for (const [key, prop] of Object.entries(tool.input_schema.properties)) {
      let exampleValue = '';
      switch (prop.type) {
        case 'string':
          exampleValue = prop.enum ? prop.enum[0] : `example_${key}`;
          break;
        case 'number':
          exampleValue = '0';
          break;
        case 'boolean':
          exampleValue = 'true';
          break;
        case 'array':
          exampleValue = '[]';
          break;
        case 'object':
          exampleValue = '{}';
          break;
        default:
          exampleValue = 'value';
      }
      params.push(`<${key}>${exampleValue}</${key}>`);
    }
  }
  
  return `<tool_call>
<name>${tool.name}</name>
<input>
${params.map(p => '  ' + p).join('\n')}
</input>
</tool_call>`;
}

/**
 * 将单个工具定义转换为 XML 格式
 */
function toolToXml(tool: ToolDefinition): string {
  const params = serializeSchema(tool.input_schema);
  const example = generateUsageExample(tool);
  
  return `### Tool: '${tool.name}'
${tool.description}
${params ? `\nParameters:\n${params}` : ''}

Usage example:
${example}`;
}

/**
 * 生成工具调用格式说明
 */
function generateCallFormat(): string {
  return `
When you need to use a tool, output in this exact XML format:
<tool_call>
<name>tool_name</name>
<input>
<param1>value1</param1>
<param2>value2</param2>
</input>
</tool_call>

You can use multiple tools in sequence by outputting multiple <tool_call> blocks.
After using a tool, wait for the result before proceeding.
If you don't need to use any tools, just respond with plain text.`;
}

/**
 * 将 Anthropic tools 定义数组转换为 XML prompt
 */
function toXmlPrompt(tools: ToolDefinition[]): string {
  if (!tools || tools.length === 0) {
    return '';
  }
  
  const toolsXml = tools.map(toolToXml).join('\n\n');
  const callFormat = generateCallFormat();
  
  return `<available_tools>
${toolsXml}
</available_tools>
${callFormat}`;
}

export const toolTransformer = {
  toXmlPrompt,
  generateCallFormat,
  toolToXml,
  serializeSchema,
};
