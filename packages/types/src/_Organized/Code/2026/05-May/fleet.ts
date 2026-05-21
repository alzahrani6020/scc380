export type PlateType = 'PRIVATE' | 'COMMERCIAL' | 'TRANSPORT' | 'HEAVY' | 'DIPLOMATIC' | 'TEMPORARY';
export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'IN_MAINTENANCE' | 'SOLD' | 'RETIRED';
export type OwnershipType = 'OWNED' | 'LEASED' | 'RENTED';
export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
export type TripStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Vehicle {
  id: string;
  plateNumber: string;
  plateType: PlateType;
  make: string;
  model: string;
  year?: number | null;
  color?: string | null;
  vin?: string | null;
  imei?: string | null;
  status: VehicleStatus;
  ownershipType: OwnershipType;
  ownerId?: string | null;
  assignedDriverId?: string | null;
  istimaraExpiry?: Date | null;
  insuranceExpiry?: Date | null;
  periodicInspectionExpiry?: Date | null;
  fuelType: FuelType;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FleetTrip {
  id: string;
  vehicleId: string;
  driverId?: string | null;
  purpose?: string | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
  startedAt: Date;
  endedAt?: Date | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  status: TripStatus;
  createdAt: Date;
}
