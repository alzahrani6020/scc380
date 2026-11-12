import { BadRequestException } from '@nestjs/common';

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365.2425;

export const END_SERVICE_REASONS = [
  'RESIGNATION',
  'EMPLOYER_TERMINATION',
  'CONTRACT_EXPIRY',
  'MUTUAL',
  'FORCE_MAJEURE',
  'ARTICLE_80',
  'ARTICLE_81',
  'PROBATION',
  'STATUTORY_FULL_AWARD',
  'OTHER',
] as const;

export const SETTLEMENT_INITIATORS = ['EMPLOYEE', 'EMPLOYER', 'MUTUAL'] as const;

export interface EndServiceCalculationInput {
  hireDate: Date;
  lastWorkingDate: Date;
  lastWage: number;
  reason: string;
  initiatedBy: string;
}

export interface EndServiceCalculation {
  serviceDays: number;
  serviceYears: number;
  baseAward: number;
  awardFactor: number;
  eosAward: number;
  dueDate: Date;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateEndService(input: EndServiceCalculationInput): EndServiceCalculation {
  const { hireDate, lastWorkingDate, lastWage, reason, initiatedBy } = input;
  if (!(hireDate instanceof Date) || Number.isNaN(hireDate.getTime())) throw new BadRequestException('Invalid hire date');
  if (!(lastWorkingDate instanceof Date) || Number.isNaN(lastWorkingDate.getTime())) throw new BadRequestException('Invalid last working date');
  if (lastWorkingDate.getTime() < hireDate.getTime()) throw new BadRequestException('Last working date cannot precede hire date');
  if (!Number.isFinite(lastWage) || lastWage < 0) throw new BadRequestException('Last wage must be non-negative');
  if (!(END_SERVICE_REASONS as readonly string[]).includes(reason)) throw new BadRequestException('Unsupported end-service reason');
  if (!(SETTLEMENT_INITIATORS as readonly string[]).includes(initiatedBy)) throw new BadRequestException('Unsupported settlement initiator');

  const serviceDays = Math.max(0, Math.floor((lastWorkingDate.getTime() - hireDate.getTime()) / DAY_MS));
  const serviceYears = serviceDays / YEAR_DAYS;

  const firstFive = Math.min(serviceYears, 5);
  const afterFive = Math.max(serviceYears - 5, 0);
  const baseAward = money((firstFive * lastWage * 0.5) + (afterFive * lastWage));

  let awardFactor = 1;
  if (reason === 'ARTICLE_80' || reason === 'PROBATION') {
    awardFactor = 0;
  } else if (reason === 'RESIGNATION') {
    if (serviceYears < 2) awardFactor = 0;
    else if (serviceYears <= 5) awardFactor = 1 / 3;
    else if (serviceYears < 10) awardFactor = 2 / 3;
    else awardFactor = 1;
  } else if (reason === 'FORCE_MAJEURE' || reason === 'ARTICLE_81' || reason === 'STATUTORY_FULL_AWARD') {
    awardFactor = 1;
  }

  const dueDate = new Date(lastWorkingDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + (initiatedBy === 'EMPLOYEE' ? 14 : 7));

  return {
    serviceDays,
    serviceYears,
    baseAward,
    awardFactor,
    eosAward: money(baseAward * awardFactor),
    dueDate,
  };
}
