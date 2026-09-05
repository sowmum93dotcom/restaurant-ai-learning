"use strict";

const repository = require("./_repository");
const { createMigrationHandler } = require("./_persistence");

module.exports = createMigrationHandler(repository);
