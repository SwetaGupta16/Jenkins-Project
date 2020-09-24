const ScopeType = `
    type ScopeType {
            name: String! 
            id: String!
            idName: String!
    }
`;

const RoleType = `
    type RoleType {
        roleId: String!
        name: String!
        displayName: String
        type:String
        description:String
        assignedToUsers:Int
        usedInScopes:Int
        privileges:[PrivilegeType] 
    }
`;

const PrivilegeType = `
    type PrivilegeType {
        privilegeId: String!
        name: String!
        description:String 
    }
`;

const ScopeRolePrivilegeType = `
    type ScopeRolePrivilegeType {
        scope: ScopeType! 
        role: RoleType! 
    }
`;

const ScopeInput = `
    input ScopeInput {
        name: String! 
        id: String!
    }
`;

const defs = [ScopeType, RoleType, PrivilegeType, ScopeRolePrivilegeType, ScopeInput];

module.exports = { defs };
