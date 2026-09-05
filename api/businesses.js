"use strict";

const repository = require("./_repository");
const { createBusinessHandler } = require("./_persistence");

module.exports = createBusinessHandler(repository);
