import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CONTACT_STATUSES, CONTACT_TYPES } from './create-contact.dto';

export class ListContactsQueryDto {
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
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(CONTACT_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsIn(CONTACT_STATUSES as unknown as string[])
  status?: string;
}
