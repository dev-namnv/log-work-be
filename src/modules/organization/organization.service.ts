import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Account } from 'src/schemas/account';
import { Organization } from 'src/schemas/organization';
import PaginationUtil, { PaginationResponse } from 'src/utils/pagination.util';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { SearchOrganizationDto } from './dto/searchOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';

import { UpdateWorkScheduleDto } from './dto/workSchedule.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
  ) {}

  async create(
    account: Account,
    dto: CreateOrganizationDto,
  ): Promise<Organization> {
    return this.organizationModel.create({
      ...dto,
      owner: account._id,
      members: [account._id],
    });
  }

  async search(
    account: Account,
    dto: SearchOrganizationDto,
  ): Promise<PaginationResponse<Organization>> {
    const filterQuery: FilterQuery<Organization> = {
      $or: [{ owner: account._id }, { members: account._id }],
    };
    const { keyword, page, limit, match, skip, sort } =
      PaginationUtil.getQueryByPagination(dto, filterQuery);

    const data = await this.organizationModel
      .aggregate()
      .match(keyword ? { $text: { $search: keyword } } : match)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await this.organizationModel.countDocuments(
      keyword ? { $text: { $search: keyword } } : match,
    );

    return PaginationUtil.getPaginationResponse({ data, limit, page, total });
  }

  async detail(id: string): Promise<Organization> {
    const org = await this.organizationModel
      .findById(id)
      .populate('owner', '_id firstName lastName email avatar')
      .populate('members', '_id firstName lastName email avatar')
      .lean();
    if (!org) throw new NotFoundException('Organization not found');
    return org as unknown as Organization;
  }

  async update(account: Account, id: string, dto: UpdateOrganizationDto) {
    const org = await this.organizationModel.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    if (org.owner.toString() !== account._id.toString()) {
      throw new ForbiddenException(
        'Only the owner can update this organization',
      );
    }
    await this.organizationModel.findByIdAndUpdate(id, dto, { new: true });
    return { message: 'Organization updated' };
  }

  async remove(account: Account, id: string) {
    const org = await this.organizationModel.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    if (org.owner.toString() !== account._id.toString()) {
      throw new ForbiddenException(
        'Only the owner can delete this organization',
      );
    }
    await org.deleteOne();
    return { message: 'Organization deleted' };
  }

  async addMember(account: Account, id: string, memberId: string) {
    const org = await this.organizationModel.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    if (org.owner.toString() !== account._id.toString()) {
      throw new ForbiddenException('Only the owner can add members');
    }
    if (org.members.some((m) => m.toString() === memberId)) {
      throw new BadRequestException('Member already in organization');
    }
    await this.organizationModel.findByIdAndUpdate(id, {
      $addToSet: { members: new Types.ObjectId(memberId) },
    });
    return { message: 'Member added' };
  }

  async removeMember(account: Account, id: string, memberId: string) {
    const org = await this.organizationModel.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    if (org.owner.toString() !== account._id.toString()) {
      throw new ForbiddenException('Only the owner can remove members');
    }
    if (memberId === account._id.toString()) {
      throw new BadRequestException('Owner cannot remove themselves');
    }
    await this.organizationModel.findByIdAndUpdate(id, {
      $pull: { members: new Types.ObjectId(memberId) },
    });
    return { message: 'Member removed' };
  }

  async findById(id: string) {
    return this.organizationModel.findById(id);
  }

  async updateWorkSchedule(
    account: Account,
    id: string,
    dto: UpdateWorkScheduleDto,
  ) {
    const org = await this.organizationModel.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    if (org.owner.toString() !== account._id.toString()) {
      throw new ForbiddenException(
        'Only the owner can update the work schedule',
      );
    }
    await this.organizationModel.findByIdAndUpdate(
      id,
      { $set: { workSchedule: dto.workSchedule } },
      { new: true },
    );
    return { message: 'Work schedule updated' };
  }
}
