import { PartialType } from '@nestjs/swagger';
import { CreateLeaseContractDto } from './create-lease-contract.dto';

export class UpdateLeaseContractDto extends PartialType(CreateLeaseContractDto) {}
