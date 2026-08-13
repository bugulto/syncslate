export {
  checkDatabaseConnection,
  createDatabaseClient,
  type DatabaseClient,
} from "./client.js";
export {
  parseDatabaseConfig,
  postgresConnectionStringSchema,
  type DatabaseConfig,
} from "./config.js";
export {
  createProfileIfMissing,
  findProfileByUserId,
  updateProfileMetadata,
  type CreateProfileIfMissingInput,
  type UpdateProfileMetadataInput,
} from "./repositories/profile.repository.js";
export { profiles, type NewProfile, type Profile } from "./schema.js";
