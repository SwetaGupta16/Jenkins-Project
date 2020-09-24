const { GraphQLError } = require('graphql');

class ServiceError extends GraphQLError {
  constructor (data) {
    if (data.message instanceof Error) {
      return data.message;
    }
    super(data.message);
    if (data.code) {
      data.code = `${this.constructor.name}.${data.code}`;
    }
    this.code = data.code || this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  serialize () {
    return JSON.stringify(this.flatten());
  }

  flatten () {
    return {
      error: this.code,
      error_description: this.message,
      locations: this.locations,
      paths: this.path,
    };
  }
}

class ValidationError extends ServiceError {}

class ConcurrentModificationError extends ServiceError {}

const UserEmailAndNameNotFound = (msg = 'User email or name is mandatory to process this operation.') =>
  new ValidationError({
    code: 'USER_EMAIL_AND_NAME_NOT_FOUND',
    message: msg,
  });

const NotFound = (entity, msg = 'Entity not found.') =>
  new ServiceError({
    code: `${entity}_NOT_FOUND`,
    message: msg,
  });

const NotAllowed = (entity, msg = 'Operation not allowed.') =>
  new ValidationError({
    code: `${entity}_NOT_ALLOWED`,
    message: msg,
  });

const NotPermitted = (entity, msg = 'Operation not permitted.') =>
  new ServiceError({
    code: `${entity}_NOT_PERMITTED`,
    message: msg,
  });

const NoUsers = (msg = 'No users are provided to perform this operation.') =>
  new ValidationError({
    code: 'NO_USERS',
    message: msg,
  });

const AlreadyExists = (entity, msg = 'Entity already exists.') =>
  new ValidationError({
    code: `${entity}_ALREADY_EXISTS`,
    message: msg,
  });

const Mandatory = (entity, msg = 'Entity is mandatory.') =>
  new ValidationError({
    code: `${entity}_MANDATORY`,
    message: msg,
  });

const NotImplemented = (msg = 'The requested service is not implemented.') =>
  new ServiceError({
    code: 'NOT_IMPLEMENTED',
    message: msg,
  });

const CreationFailed = (entity, msg = 'Entity creation failed.') =>
  new ServiceError({
    code: `${entity}_CREATION_FAILED`,
    message: msg,
  });

const UpdationFailed = (entity, msg = 'Entity updation failed.') =>
  new ServiceError({
    code: `${entity}_UPDATION_FAILED`,
    message: msg,
  });

const DBQueryFailed = (entity = 'DB', msg = 'DB query execution failed.') =>
  new ServiceError({
    code: `${entity}_QUERY_FAILED`,
    message: msg,
  });

const ExceededLicenseLimit = (entity, msg = 'License Exceeds limit.') =>
  new ServiceError({
    code: `${entity}_EXCEED_LIMIT`,
    message: msg,
  });

module.exports = {
  ServiceError,
  ValidationError,
  ConcurrentModificationError,
  UserEmailAndNameNotFound,
  NoUsers,
  AlreadyExists,
  Mandatory,
  NotFound,
  NotImplemented,
  CreationFailed,
  DBQueryFailed,
  ExceededLicenseLimit,
  UpdationFailed,
  NotAllowed,
  NotPermitted,
};
