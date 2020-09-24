def call(String branchName = null){

    echo "In getBranchName function..."
    echo "Branch value is ...${branchName} "
    if(branchName == null)
    {
        echo "In if"
        branch = "${BRANCH_NAME}"
    }else
    {
        branch = "${branchName}"
    }
    echo "Branch value is ${branch}"
    string = branch.replaceAll("/","-").replaceAll("_","-").toLowerCase().take(40)
    echo "${string}......."
    

    return "${string}"
}       