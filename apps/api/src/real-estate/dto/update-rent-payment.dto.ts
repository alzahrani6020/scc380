import { PartialType } from '@nestjs/swagger';
import { CreateRentPaymentDto } from './create-rent-payment.dto';

export class UpdateRentPaymentDto extends PartialType(CreateRentPaymentDto) {}
