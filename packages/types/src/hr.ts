export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN' | 'TEMPORARY';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  nationality?: string | null;
  departmentId?: string | null;
  jobTitle?: string | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  hireDate: Date;
  terminationDate?: Date | null;
  basicSalary?: number | null;
  housingAllowance?: number | null;
  transportAllowance?: number | null;
  otherAllowances?: number | null;
  gosiNumber?: string | null;
  gosiSalary?: number | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  managerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
