def call(Map param){

    sh "kubectl get pods -n ${param.namespace} --kubeconfig ${param.kubeConfigPath}"
    // Restoring Neo4j backup
    withCredentials(
        [[$class: 'AmazonWebServicesCredentialsBinding', 
        accessKeyVariable: 'AWS_ACCESS_KEY_ID', 
        credentialsId: 'Jenkin_AWS_Cred', 
        secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
            
            sh "kubectl exec -it ${param.neo4jReleaseName}-neo4j-core-0 -- /bin/bash -c  \"bash backup.sh ${param.s3BucketName} ${param.environment} $AWS_ACCESS_KEY_ID $AWS_SECRET_ACCESS_KEY\" -n ${param.namespace} --kubeconfig ${param.kubeConfigPath}"
        }
    
}

/* Usage :
 neo4jBackup(
     s3BucketName: "${s3BucketName}",
     environment: "test-feature",
     namespace: ${namespace},
     neo4jReleaseName: "neo4j-${namespace}", 
     kubeConfigPath: '/home/ubuntu/kubeconfig'
 ) */