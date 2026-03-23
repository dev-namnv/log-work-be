import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Observable } from 'rxjs';
import { PaginationDto } from 'src/dto/pagination.dto';
import { AccountRole } from 'src/interfaces/Account';
import { MongoId } from 'src/interfaces/MongoId';
import { Account } from 'src/schemas/account';
import PaginationUtil, { PaginationResponse } from 'src/utils/pagination.util';
import { SearchAccountDto } from './dto/searchAccount.dto';
import { UpdateLocationDto } from './dto/updateLocation.dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<Account>,
  ) {}

  async searchAccount(
    dto: SearchAccountDto,
  ): Promise<PaginationResponse<Account>> {
    const filterQuery: FilterQuery<Account> = {};
    const { keyword, page, limit, match, skip, sort } =
      PaginationUtil.getQueryByPagination(dto, filterQuery);

    const accounts = await this.accountModel
      .aggregate()
      .match(keyword ? { $text: { $search: keyword } } : match)
      .addFields(keyword ? { score: { $meta: 'textScore' } } : {})
      .sort(
        keyword
          ? {
              score: { $meta: 'textScore' },
            }
          : sort,
      )
      .skip(skip)
      .limit(limit);

    const total = await this.accountModel.countDocuments(
      keyword ? { $text: { $search: keyword } } : match,
    );

    return PaginationUtil.getPaginationResponse({
      data: accounts,
      limit,
      page,
      total,
    });
  }

  async updateLocation(
    _id: MongoId,
    updateLocationDto: UpdateLocationDto,
  ): Promise<Account | null | Observable<never>> {
    return this.accountModel.findByIdAndUpdate(_id, updateLocationDto, {
      new: true,
    });
  }

  async findById(id: string | MongoId) {
    return this.accountModel.findById(id);
  }

  async findByIdOrEmail(value: string) {
    let byId: Account | null = null;
    if (MongoId.isValid(value)) {
      byId = await this.accountModel.findById(value);
    }
    if (byId) {
      return byId;
    }
    return this.accountModel.findOne({ email: value.toLowerCase().trim() });
  }

  async listAccounts(dto: PaginationDto) {
    const pagination = await PaginationUtil.response(this.accountModel, dto);
    const accounts = pagination.data;
    return {
      ...pagination,
      data: accounts,
    };
  }

  async detail(id: string) {
    const account = await this.accountModel
      .findById(id)
      .select({ password: 0 })
      .lean();
    if (!account) {
      throw new NotFoundException('Account not found!');
    }
    return account;
  }

  async delete(id: string) {
    const account = await this.accountModel.findById(id);
    if (!account) {
      throw new NotFoundException('Account not found!');
    }
    if (account.role === AccountRole.ADMIN) {
      throw new ForbiddenException("Can't delete an admin");
    }
    await account.deleteOne();
    return `Account ${account.email} has been deleted`;
  }

  async getAdmins() {
    return this.accountModel.find({ role: AccountRole.ADMIN }).lean();
  }

  async findOne(filter: FilterQuery<Account>) {
    return this.accountModel.findOne(filter);
  }
}
