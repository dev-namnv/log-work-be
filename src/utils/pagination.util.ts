import { FilterQuery, Model, PopulateOptions, SortOrder } from 'mongoose';
import { PaginationDto } from 'src/dto/pagination.dto';

interface PaginationParams {
  page: number;
  limit: number;
  sort?: {
    field: string;
    order: SortOrder;
  };
  search?: {
    field: string;
    value: string | number | boolean;
  }[];
}

interface PaginationBody<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface PaginationResponse<T> {
  data: T[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}

interface QueryByPagination<Doc> {
  page: number;
  limit: number;
  match: FilterQuery<Doc>;
  sort: { [key: string]: SortOrder };
  skip: number;
  keyword: string;
}

const PaginationUtil = {
  getPaginationParams(paginationDto: PaginationDto): PaginationParams {
    const { page, limit, sort, search } = paginationDto;
    return { page, limit, sort, search };
  },

  getQueryByPagination<T>(
    paginationDto: PaginationDto,
    initialMatch?: FilterQuery<T>,
  ): QueryByPagination<T> {
    const {
      page = 1,
      limit = 20,
      sort: sortParams,
      search: searchParams,
      keyword = '',
    } = paginationDto;
    const skip = (page - 1) * limit;
    let sort: { [key: string]: SortOrder } = { _id: 'asc' };
    if (sortParams) {
      sort = { [sortParams.field]: sortParams.order };
    }
    let match: FilterQuery<T> = initialMatch || {};
    if (searchParams && searchParams.length > 0) {
      searchParams.forEach((searchItem) => {
        if (typeof searchItem.value === 'boolean') {
          match = { ...match, [searchItem.field]: searchItem.value };
        } else if (typeof searchItem.value === 'number') {
          match = { ...match, [searchItem.field]: searchItem.value };
        } else {
          match = {
            ...match,
            [searchItem.field]: { $regex: searchItem.value },
          };
        }
      });
    }
    return { page, limit, sort, match, skip, keyword };
  },

  getPaginationResponse<T>(body: PaginationBody<T>): PaginationResponse<T> {
    const { page, limit, data, total } = body;
    return {
      page,
      data,
      total,
      perPage: limit,
      lastPage: Math.ceil(total / limit) || 1,
    };
  },
  async response<T>(
    model: Model<T>,
    paginationDto: PaginationDto,
    initialMatch: FilterQuery<T> = {},
    populates?: PopulateOptions[],
  ): Promise<PaginationResponse<T>> {
    const { page, limit, sort, match, skip } = this.getQueryByPagination(
      paginationDto,
      initialMatch,
    );
    let query = model.find(match).sort(sort).limit(limit).skip(skip);
    if (populates) {
      populates.forEach((item) => {
        // eslint-disable-next-line
        // @ts-ignore
        query = query.populate(item);
      });
    }
    const [data, total] = await Promise.all([
      query,
      model.countDocuments(match),
    ]);
    return this.getPaginationResponse({
      page,
      limit,
      data: data as Array<T>,
      total,
    });
  },
};

export default PaginationUtil;
