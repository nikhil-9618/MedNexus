const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

/** Build a params schema requiring a valid ObjectId at `key` (default "id"). */
const objectIdParam = (key = 'id') => z.object({ [key]: objectId });

module.exports = { objectId, objectIdParam };
