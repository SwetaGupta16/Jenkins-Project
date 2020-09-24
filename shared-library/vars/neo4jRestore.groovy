def call(Map param){

    sh "kubectl get pods -n ${param.namespace} --kubeconfig ${param.kubeConfigPath}"
    // Restoring Neo4j backup
    withCredentials(
        [[$class: 'AmazonWebServicesCredentialsBinding', 
        accessKeyVariable: 'AWS_ACCESS_KEY_ID', 
        credentialsId: 'Jenkin_AWS_Cred', 
        secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
            
            // sh label: 'Neo4j restore', 
            //    returnStdout: true, 
            //    script: 'kubectl exec -it ${param.neo4jReleaseName}-neo4j-core-0 -- /bin/bash -c  "bash restore.sh ${param.backupFile} ${param.s3BucketName} $AWS_ACCESS_KEY_ID $AWS_SECRET_ACCESS_KEY " -n ${param.namespace} --kubeconfig ${param.kubeConfigPath}'
           echo "Pod name is = ${param.neo4jReleaseName}-neo4j-core-0"
           sh "kubectl exec -it ${param.neo4jReleaseName}-neo4j-core-0 -- /bin/bash -c ls -n ${param.namespace} --kubeconfig ${param.kubeConfigPath}"
           sh "kubectl exec -it ${param.neo4jReleaseName}-neo4j-core-0 -- /bin/bash -c \" bash restore.sh ${param.backupFile} ${param.s3BucketName} $AWS_ACCESS_KEY_ID $AWS_SECRET_ACCESS_KEY \" -n ${param.namespace} --kubeconfig ${param.kubeConfigPath}"
        }
    // Restarting Neo4j Pod
    sh "kubectl delete po ${param.neo4jReleaseName}-neo4j-core-0 -n ${param.namespace} --kubeconfig ${param.kubeConfigPath}"
}

/* Usage :
 neo4jRestore(
     s3BucketName: "${s3BucketName}",
     backupFile: "${backupFile}",
     namespace: ${namespace},
     neo4jReleaseName: "neo4j-${namespace}", 
     kubeConfigPath: '/home/ubuntu/kubeconfig'
 ) */