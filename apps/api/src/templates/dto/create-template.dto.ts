export class CreateTemplateDto {
  name: string;
  nameAr?: string;
  category: string;
  subcategory?: string;
  description?: string;
  templateKey: string;
  htmlTemplate: string;
  cssStyles?: string;
  dataBindings?: Record<string, any>;
  defaultData?: Record<string, any>;
  paperSize?: string;
  orientation?: string;
  icon?: string;
  tags?: string[];
}
