import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator'

@ValidatorConstraint({ name: 'isNotBlank', async: false })
export class IsNotBlankConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    return typeof value === 'string' && value.trim().length > 0
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property.toString()} should not be empty`
  }
}

export function IsNotBlank(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [],
      options,
      validator: IsNotBlankConstraint
    })
  }
}
