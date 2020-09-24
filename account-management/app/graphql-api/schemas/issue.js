const IssueType = `
    type IssueType {
        parentIssues: [SubIssueType]
        childIssues: [SubIssueType]
    }
`;

const SubIssueType = `
    type SubIssueType {
        issueId: String
        name: String
        type: String
        isDeleted: Boolean
    }
`;

const IssueInput = `
    input IssueInput {
        type: String!
        isOrphan: Boolean
        parentIssueId: String
    }
`;

const defs = [IssueType, SubIssueType, IssueInput];

module.exports = { defs };
