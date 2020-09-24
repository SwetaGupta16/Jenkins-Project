const UserType = `
    type UserType {
        userId: String!
        name: String 
        email: String!
        password: String
        phoneNumber: String 
        status:String
        organization:OrganizationType
    }
`;

const UserProjectsType = `
    type UserProjectsType{
        project:ProjectType
        role:String
        createdAt:String
    }
`;

const UserProjectData = `
    type UserProjectData {
        totalCount: Int
        data: [UserProjectsType]
    }
`;

const UserOrganizationType = `
    type UserOrganizationType{
        organization:OrganizationType
        role:String
        createdAt:String
    }
`;

const UsersType = `
    type UsersType {
        user:UserType
        userOrganization:UserOrganizationType
        userProjects:[UserProjectsType]
    }
`;

const UserData = `
    type UserData {
        totalCount: Int
        data : [UsersType]
    }
`;

const UserInput = `
    input UserInput {
        userId: String
        name: String 
        email: String
        password: String
        phoneNumber: String
        projectRole: String
    }
`;

const UsersInput = `
    input UsersInput { 
        businessUnitId:String
        users:[UserInput]
    }
`;

const defs = [UserType, UserInput, UsersInput, UserProjectData, UserProjectsType, UsersType, UserData, UserOrganizationType];

module.exports = { defs };
