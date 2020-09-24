const OwnerType = `
    type OwnerType { 
        ownershipId:String
        name:String
        type:String
    }
`;

const defs = [OwnerType];

module.exports = { defs };
