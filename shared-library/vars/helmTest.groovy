def call(Map param){

    namespace = "dnd-helm-chart-test"

    sh "helm upgrade --install ${param.chartName} --wait --timeout 2m0s --atomic --set deployment.image.repository=${param.imageRepository},deployment.image.tag=${param.imageTag} chart/${param.chartName} --kubeconfig ${param.kubeConfigPath} --namespace ${namespace}"
    sh "helm list --kubeconfig ${param.kubeConfigPath} --namespace ${namespace}"

    // Cleaning up helm release
    sh "helm uninstall ${param.chartName} --kubeconfig ${param.kubeConfigPath} --namespace ${namespace}"

}

/*Usage
helmTest(
    kubeConfigPath: '/home/ubuntu/kubeconfig',
    chartName: 'notification',
    imageTag: "${patch}",
    imageRepository: "${imageRepository}"            
)
*/