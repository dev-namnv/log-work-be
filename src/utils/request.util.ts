const RequestUtil = {
  getParameters<Dto extends object>(dto: Dto): Dto {
    const keys = Object.keys(dto);
    let result: Dto;
    keys.forEach((key) => {
      const keyValue: any = dto[key];
      if (typeof keyValue === 'boolean') {
        result = { ...result, [key]: keyValue };
      } else if (typeof keyValue === 'number') {
        result = { ...result, [key]: keyValue };
      } else {
        result = { ...result, [key]: keyValue };
      }
    });

    return result;
  },
};

export default RequestUtil;
