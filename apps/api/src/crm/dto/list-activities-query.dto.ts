import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ActivityType } from '@prisma/client';

export class ListActivitiesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;

  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dealId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  assignedToId?: string;

  @IsOptional()
  @IsIn(['scheduled', 'recent'])
  sort?: 'scheduled' | 'recent';
}
