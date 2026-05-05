import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRef } from 'src/schemas/user-ref';

/**
 * Manages per-user reference data — a single document per user that caches
 * lightweight "last used" or "default" values reusable across features.
 *
 * Usage pattern:
 *   await this.userRefService.setLastWorkLogOrganization(accountId, orgId);
 *   const orgId = await this.userRefService.getLastWorkLogOrganization(accountId);
 *
 * Extend by adding new typed getter/setter pairs below.
 */
@Injectable()
export class UserRefService {
  constructor(
    @InjectModel(UserRef.name) private userRefModel: Model<UserRef>,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

  /**
   * Upsert arbitrary fields into the user's UserRef document.
   * All public setters delegate here.
   */
  private async patch(
    accountId: string | Types.ObjectId,
    fields: Partial<
      Omit<UserRef, '_id' | 'account' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<UserRef> {
    return this.userRefModel.findOneAndUpdate(
      { account: this.toObjectId(accountId) },
      { $set: fields },
      { upsert: true, new: true },
    );
  }

  private async get(
    accountId: string | Types.ObjectId,
  ): Promise<UserRef | null> {
    return this.userRefModel
      .findOne({ account: this.toObjectId(accountId) })
      .lean();
  }

  // ─── WorkLog: last used organization ──────────────────────────────────────

  async setLastWorkLogOrganization(
    accountId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
  ): Promise<void> {
    await this.patch(accountId, {
      lastWorkLogOrganization: this.toObjectId(organizationId),
    });
  }

  async getLastWorkLogOrganization(
    accountId: string | Types.ObjectId,
  ): Promise<Types.ObjectId | null> {
    const ref = await this.get(accountId);
    return ref?.lastWorkLogOrganization ?? null;
  }

  // ─── Full ref for API response ─────────────────────────────────────────────

  /** Returns the UserRef document with populated references, for the API layer. */
  async getForAccount(
    accountId: string | Types.ObjectId,
  ): Promise<UserRef | null> {
    return this.userRefModel
      .findOne({ account: this.toObjectId(accountId) })
      .populate('lastWorkLogOrganization', '_id name workSchedule')
      .lean();
  }
}
