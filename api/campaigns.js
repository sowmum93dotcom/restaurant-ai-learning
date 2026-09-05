"use strict";

const repository = require("./_repository");
const { createCampaignHandler } = require("./_persistence");

module.exports = createCampaignHandler(repository);
