export class UpdateTemplateDto {
  name?: string;
  nameAr?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  htmlTemplate?: string;
  cssStyles?: string;
  dataBindings?: Record<string, any>;
  defaultData?: Record<string, any>;
  paperSize?: string;
  orientation?: string;
  isActive?: boolean;
  icon?: string;
  tags?: string[];
}
