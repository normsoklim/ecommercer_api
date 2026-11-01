import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, dto: CreateAddressDto) {
    const result = await this.db.query(
      `INSERT INTO customer_addresses (user_id, label, recipient_phone, address_line, formatted_address, latitude, longitude, place_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, user_id, label, recipient_phone, address_line, formatted_address, latitude, longitude, place_id, "isDefault", "createdAt", "updatedAt"`,
      [
        userId,
        dto.label,
        dto.recipientPhone,
        dto.addressLine,
        dto.formattedAddress,
        dto.latitude,
        dto.longitude,
        dto.placeId,
      ],
    );

    return result.rows[0];
  }

  async findAll(userId: string) {
    const result = await this.db.query(
      'SELECT id, user_id, label, recipient_phone, address_line, formatted_address, latitude, longitude, place_id, "isDefault", "createdAt", "updatedAt" FROM customer_addresses WHERE user_id = $1 ORDER BY "createdAt" DESC',
      [userId],
    );

    return result.rows;
  }

  async findOne(userId: string, id: string) {
    const result = await this.db.query(
      'SELECT id, user_id, label, recipient_phone, address_line, formatted_address, latitude, longitude, place_id, "isDefault", "createdAt", "updatedAt" FROM customer_addresses WHERE id = $1 AND user_id = $2',
      [id, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Address not found');
    }

    return result.rows[0];
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const address = await this.findOne(userId, id);

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    if (dto.label !== undefined) {
      updateFields.push(`label = $${paramIndex++}`);
      updateValues.push(dto.label);
    }
    if (dto.recipientPhone !== undefined) {
      updateFields.push(`recipient_phone = $${paramIndex++}`);
      updateValues.push(dto.recipientPhone);
    }
    if (dto.addressLine !== undefined) {
      updateFields.push(`address_line = $${paramIndex++}`);
      updateValues.push(dto.addressLine);
    }
    if (dto.formattedAddress !== undefined) {
      updateFields.push(`formatted_address = $${paramIndex++}`);
      updateValues.push(dto.formattedAddress);
    }
    if (dto.latitude !== undefined) {
      updateFields.push(`latitude = $${paramIndex++}`);
      updateValues.push(dto.latitude);
    }
    if (dto.longitude !== undefined) {
      updateFields.push(`longitude = $${paramIndex++}`);
      updateValues.push(dto.longitude);
    }
    if (dto.placeId !== undefined) {
      updateFields.push(`place_id = $${paramIndex++}`);
      updateValues.push(dto.placeId);
    }
    if (dto.isDefault !== undefined) {
      updateFields.push(`"isDefault" = $${paramIndex++}`);
      updateValues.push(dto.isDefault);
    }
    updateFields.push(`"updatedAt" = NOW()`);
    updateValues.push(id);

    const result = await this.db.query(
      `UPDATE customer_addresses SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, user_id, label, recipient_phone, address_line, formatted_address, latitude, longitude, place_id, "isDefault", "createdAt", "updatedAt"`,
      updateValues,
    );

    return result.rows[0];
  }

  async remove(userId: string, id: string) {
    const address = await this.findOne(userId, id);

    await this.db.query('DELETE FROM customer_addresses WHERE id = $1', [
      address.id,
    ]);

    return { id };
  }
}
