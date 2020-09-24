const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const graphQLAPI = require('./graphql-api');
const ISCALLBACKURI = '/api/v1/q/ds/integrationmanagement/callback/sync';
const URI = '/api/v1/q/ds/accountmanagement';
const srp = require('./middleware/scopeRolePrivilege');
const auth = require('./middleware/auth');
const issueNode = require('./services').issue;

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
router.get(URI, graphQLAPI.site);
router.post(ISCALLBACKURI, issueNode.handleCallback);
router.use(URI, srp, auth, graphQLAPI.middleware);

module.exports = router;
