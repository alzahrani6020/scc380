import { Injectable, Logger } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

interface WasslVehiclePayload {
  plateNumber: string;
  plateType: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  operatingLicense?: string;
  licenseExpiry?: string;
  loadCapacityKg?: number;
  axleCount?: number;
  euroClass?: string;
  vehicleCategory?: string;
  gpsDeviceId?: string;
}

interface WasslTelemetryPayload {
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number;
  altitude?: number;
  accuracy?: number;
  ignitionOn?: boolean;
  engineHours?: number;
  recordedAt: string; // ISO 8601
}

@Injectable()
export class WasslService {
  private readonly logger = new Logger(WasslService.name);
  private readonly baseUrl = process.env.WASSL_API_URL || 'https://api.wassl.sa/v1';
  private readonly apiKey = process.env.WASSL_API_KEY || '';

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  /**
   * Register (or sync) a vehicle with TGA Wassl platform.
   * In demo mode, logs payload and returns mock response.
   */
  async registerVehicle(tenantId: string, vehicleId: string): Promise<any> {
    const vehicle = await prisma.vehicle.findFirst({
      where: withTenant({ id: vehicleId }, tenantId),
    });
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    const payload: WasslVehiclePayload = {
      plateNumber: vehicle.plateNumber,
      plateType: vehicle.plateType,
      vin: vehicle.vin ?? undefined,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year ?? undefined,
      operatingLicense: vehicle.tgaOperatingLicense ?? undefined,
      licenseExpiry: vehicle.tgaLicenseExpiry?.toISOString(),
      loadCapacityKg: vehicle.loadCapacityKg
        ? Number(vehicle.loadCapacityKg)
        : undefined,
      axleCount: vehicle.axleCount ?? undefined,
      euroClass: vehicle.euroClass ?? undefined,
      vehicleCategory: vehicle.vehicleCategory ?? undefined,
      gpsDeviceId: vehicle.gpsDeviceId ?? undefined,
    };

    if (!this.apiKey) {
      this.logger.warn(`[WASSL DEMO] registerVehicle: ${JSON.stringify(payload)}`);
      return { success: true, wasslVehicleId: `wassl-${vehicleId}`, demo: true };
    }

    try {
      const res = await fetch(`${this.baseUrl}/vehicles`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.message || 'Wassl registration failed');
      this.logger.log(`Wassl registered vehicle ${vehicle.plateNumber}`);
      return data;
    } catch (err: any) {
      this.logger.error(`Wassl registerVehicle failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Submit GPS telemetry to Wassl.
   * In demo mode, logs and stores locally in VehicleGpsLog.
   */
  async submitTelemetry(
    tenantId: string,
    vehicleId: string,
    payload: WasslTelemetryPayload,
  ): Promise<any> {
    const vehicle = await prisma.vehicle.findFirst({
      where: withTenant({ id: vehicleId }, tenantId),
    });
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Always store locally first
    await prisma.vehicleGpsLog.create({
      data: {
        tenantId,
        vehicleId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        speed: payload.speed,
        heading: payload.heading ?? null,
        altitude: payload.altitude ?? null,
        accuracy: payload.accuracy ?? null,
        ignitionOn: payload.ignitionOn ?? true,
        engineHours: payload.engineHours ?? null,
        deviceId: payload.deviceId,
        recordedAt: new Date(payload.recordedAt),
      },
    });

    // Update vehicle last known location
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        lastLatitude: payload.latitude,
        lastLongitude: payload.longitude,
        lastLocationAt: new Date(payload.recordedAt),
        lastSpeed: payload.speed,
        lastHeading: payload.heading ?? null,
      },
    });

    // Speed violation check
    if (vehicle.maxSpeedLimit && payload.speed > Number(vehicle.maxSpeedLimit)) {
      await prisma.fleetViolation.create({
        data: {
          tenantId,
          vehicleId,
          driverId: vehicle.assignedDriverId,
          type: 'SPEEDING',
          severity: payload.speed > Number(vehicle.maxSpeedLimit) + 30 ? 'MAJOR' : 'MINOR',
          description: `Speed ${payload.speed} km/h exceeds limit ${vehicle.maxSpeedLimit} km/h`,
          latitude: payload.latitude,
          longitude: payload.longitude,
          speedAtViolation: payload.speed,
          speedLimit: Number(vehicle.maxSpeedLimit),
          occurredAt: new Date(payload.recordedAt),
        },
      });
    }

    if (!this.apiKey) {
      this.logger.warn(`[WASSL DEMO] submitTelemetry: ${JSON.stringify(payload)}`);
      return { success: true, demo: true };
    }

    try {
      const res = await fetch(`${this.baseUrl}/telemetry`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          deviceId: payload.deviceId,
          plateNumber: vehicle.plateNumber,
          ...payload,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.message || 'Wassl telemetry failed');
      this.logger.log(`Wassl telemetry accepted for ${vehicle.plateNumber}`);
      return data;
    } catch (err: any) {
      this.logger.error(`Wassl submitTelemetry failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Batch submit telemetry (for bulk GPS uploads).
   */
  async submitTelemetryBatch(
    tenantId: string,
    vehicleId: string,
    payloads: WasslTelemetryPayload[],
  ): Promise<any> {
    const results = [];
    for (const payload of payloads) {
      const result = await this.submitTelemetry(tenantId, vehicleId, payload);
      results.push(result);
    }
    return { success: true, count: results.length };
  }

  /**
   * Fetch vehicle compliance status from Wassl.
   */
  async getComplianceStatus(tenantId: string, vehicleId: string): Promise<any> {
    const vehicle = await prisma.vehicle.findFirst({
      where: withTenant({ id: vehicleId }, tenantId),
    });
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (!this.apiKey) {
      this.logger.warn(`[WASSL DEMO] getComplianceStatus for ${vehicle.plateNumber}`);
      return {
        plateNumber: vehicle.plateNumber,
        status: 'COMPLIANT',
        violations: 0,
        lastSync: new Date().toISOString(),
        demo: true,
      };
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/vehicles/${vehicle.plateNumber}/compliance`,
        { headers: this.getHeaders() },
      );
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.message || 'Wassl compliance fetch failed');
      return data;
    } catch (err: any) {
      this.logger.error(`Wassl getComplianceStatus failed: ${err.message}`);
      throw err;
    }
  }
}
