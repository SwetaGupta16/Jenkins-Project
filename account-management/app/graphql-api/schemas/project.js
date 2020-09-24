const ProjectUserType = `
    type ProjectUserType {
        userId: String
        name: String 
        email: String
        phoneNumber: String 
        status:String
        role: String
    }
`;

const ProjectType = `
    type ProjectType {
        projectId: String
        name: String
        description: String
        createdAt: String
        status: String
        users: [ProjectUserType]    
        severities: [SeverityType]
        priorities: [PriorityType]
        ownerTypes: [OwnerType]
    }
`;

const ProjectData = `
    type ProjectData {
        totalCount: Int
        data: [ProjectType]
    }
`;

const SeverityType = `
    type SeverityType {
        severityId: String
        name: String
        value: String
    }
`;

const UpdateSeverityInput = `
    input UpdateSeverityInput {
        severityId: String
        value: String
    }
`;

const PriorityType = `
    type PriorityType {
        priorityId: String
        name: String
        value: String
    }
`;

const UpdatePriorityInput = `
    input UpdatePriorityInput {
        priorityId: String
        value: String
    }
`;

const ProjectInput = `
    input ProjectInput {
        name: String!
        description: String!
        key: String
        businessUnitId: String
        projectManagerId: String
    }
`;

const UpdateProjectInput = `
    input UpdateProjectInput {
        name: String!
        description: String
    }
`;

const defs = [ProjectType, ProjectData, ProjectUserType, ProjectInput, UpdateProjectInput, SeverityType, PriorityType, UpdateSeverityInput, UpdatePriorityInput];

module.exports = { defs };
