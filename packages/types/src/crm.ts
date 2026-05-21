export type ContactType = 'CUSTOMER' | 'LEAD' | 'PROSPECT' | 'PARTNER' | 'SUPPLIER' | 'VENDOR';
export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'CONVERTED' | 'BLACKLISTED';
export type LeadSource = 'WEBSITE' | 'SOCIAL_MEDIA' | 'REFERRAL' | 'PHONE' | 'EMAIL' | 'WALK_IN' | 'GOVERNMENT_PORTAL' | 'TRADE_SHOW' | 'OTHER';
export type DealStage = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
export type ActivityType = 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'NOTE' | 'WHATSAPP' | 'SMS' | 'VISIT';

export interface Contact {
  id: string;
  type: ContactType;
  status: ContactStatus;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  phone2?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  idNumber?: string | null;
  vatNumber?: string | null;
  crNumber?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  zipCode?: string | null;
  country: string;
  source?: LeadSource | null;
  stage?: DealStage | null;
  assignedToId?: string | null;
  customFields?: Record<string, any>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  title: string;
  description?: string | null;
  contactId: string;
  value?: number | null;
  currency: string;
  stage: DealStage;
  probability?: number | null;
  expectedClose?: Date | null;
  actualClose?: Date | null;
  assignedToId?: string | null;
  pipelineId?: string | null;
  stageOrder?: number | null;
  customFields?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
