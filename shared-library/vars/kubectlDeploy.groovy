def call(Map param){

    param.each{ k, v -> println "${k}:${v}" }
    // To get pods details
    sh "kubectl get pods -n ${param.namespace} --kubeconfig ${param.kubeconfigFile}" 

    // To change docker image
    sh "kubectl set image ${param.objectToModify} ${param.containerName}=${param.dockerImageName} -n ${param.namespace} --kubeconfig ${param.kubeconfigFile}" 

    // To verify docker images change
    sh "kubectl describe pods -n ${param.namespace} --kubeconfig ${param.kubeconfigFile} | grep Image"

}