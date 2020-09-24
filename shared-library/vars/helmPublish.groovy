def call(Map param){
    echo "in helm publish"
    withCredentials([usernamePassword(
            credentialsId: "nexuscreds",
            usernameVariable: "USER",
            passwordVariable: "PASS"
    )]){
        sh "helm nexus-push ${param.nexusRepoName} ${param.chartName}-${param.helmVersion}.tgz --username $USER --password $PASS"
    } 
   sh "rm -rf ${param.chartName}-${param.helmVersion}.tgz"

}

/* Usage :
 helmPublish(
     helmVersion: "${helmVersion}",
     nexusRepoName: 'qds-nexus',
     chartName: '/tmp/notification'
 ) */