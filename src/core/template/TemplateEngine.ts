/**
 * Template Engine
 * 项目模板引擎
 */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  files: TemplateFile[];
  variables: TemplateVariable[];
}

export interface TemplateFile {
  path: string;
  content: string;
  isTemplate: boolean;
}

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export class TemplateEngine {
  private templates: Map<string, ProjectTemplate> = new Map();

  addTemplate(template: ProjectTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  searchTemplates(query: string): ProjectTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTemplates().filter(
      (template) =>
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async generateProject(
    templateId: string,
    targetPath: string,
  ): Promise<void> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Implementation would generate project files
  }

  renderTemplate(content: string, variables: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  validateVariables(template: ProjectTemplate, variables: Record<string, string>): string[] {
    const errors: string[] = [];
    for (const variable of template.variables) {
      if (variable.required && !variables[variable.name]) {
        errors.push(`Required variable "${variable.name}" is missing`);
      }
    }
    return errors;
  }
}

export default TemplateEngine;
