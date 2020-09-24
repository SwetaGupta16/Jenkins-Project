def call(Map gitParam){

    deleteDir()
    checkout([
        $class: 'GitSCM', 
        branches: [[name: gitParam.branch ]], 
        doGenerateSubmoduleConfigurations: false, 
        extensions: [], 
        submoduleCfg: [], 
        userRemoteConfigs: [[
            credentialsId: gitParam.gitCredential, 
            url: gitParam.url
            ]]
        ]) 
    
}

/* Usage:
gitCheckout(
    url: "http://github.com/SwetaGupta16/qualitia/design-studio/notification-poc.git",
    branch: "${BRANCH_NAME}",
    gitCredential: "gitlab-repo-access"
) */

