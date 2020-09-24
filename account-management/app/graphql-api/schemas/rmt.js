const RMTType = `
    type RMTType {
        type: [RMTSupport]
    }
`;
const ConnectionStatus = `
    type ConnectionStatus {
        status: Boolean
    }
`;

const RMTInput = `
    input RMTInput {
        serverUrl: String
        username: String
        password: String
        encryptedPassword: String
        pat: String
        type: RMTSupport
        projectName: String
        auth: RMTAuth
    }
`;

const RMTIssueInput = `
    input RMTIssueInput {
        parentIssue: String
        selectedId: [String]
    }
`;

const RMTSupport = `
    enum RMTSupport {
        JIRA
        TFS
    }
`;

const RMTAuth = `
    enum RMTAuth {
        BEARER_TOKEN
        BASIC
        OAUTH
    }
`;

const RMTDetails = `
    type RMTDetails {
        type: String
        serverUrl: String
        username: String
        password: String
        passwordLength: Int
        pat: String
        rmtProjectSourceId: Int
        rmtProjectId: String
        rmtProjectName: String
        issueTypes: [RMTIssueType]
    }
`;

const RMTProjectType = `
    type RMTProjectType {
        projectId: String
        projectName: String
        projectDescription: String
        key: String
        modifiedDate: String
    }
`;

const RMTProjectEntityType = `
    type RMTProjectEntityType {
        id: String
        name: String
        description: String
    }
`;

const RMTProjectEntityDetail = `
    type RMTProjectEntityDetail {
        id: String
        name: String
        key: String
        description: String
        createdDate: String
        modifiedDate: String
        type: String
    }
`;

const RMTIssueType = `
    type RMTIssueType {
        rmtIssueTypeId: String
        level: String
        type: String
        searchKey: String
    }
`;

const defs = [RMTType, ConnectionStatus, RMTSupport, RMTInput, RMTIssueInput, RMTAuth, RMTDetails, RMTProjectType, RMTProjectEntityType, RMTProjectEntityDetail, RMTIssueType];

module.exports = { defs };
